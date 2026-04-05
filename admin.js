// --- Supabase Config ---
const supabaseClient = window.supabase ?
    window.supabase.createClient('https://jylruqsfrosqgrbwiwyy.supabase.co', 'sb_publishable_KhmtGP8jm4koH21QXMMSjw_jaLDq8RE') :
    null;

// --- State ---
let allGroups = [];
let currentTargetUserId = null;

// --- 1. Session & Login Handling ---
document.addEventListener('DOMContentLoaded', () => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (isAdmin === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        initAdmin();
    }
});

async function checkLogin() {
    const pass = document.getElementById('admin-pass').value.trim();
    
    // Hash the input password using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(pass);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // The SHA-256 hash of 'admin12345'
    const targetHash = '41e5653fc7aeb894026d6bb7b2db7f65902b454945fa8fd65a6327047b5277fb';

    if (hashHex === targetHash) {
        sessionStorage.setItem('isAdmin', 'true');
        document.getElementById('login-overlay').style.display = 'none';
        initAdmin();
    } else {
        alert('Invalid password!');
    }
}

function logout() {
    sessionStorage.removeItem('isAdmin');
    location.reload();
}

// --- 2. Tab Navigation ---
function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (sectionId === 'pending') loadPending();
    if (sectionId === 'calendar') loadCalendar();
    if (sectionId === 'report') loadReport();
    if (sectionId === 'users') loadUsers();
    if (sectionId === 'groups') loadGroups();
    if (sectionId === 'projects') loadProjects();
}

async function initAdmin() {
    initCalendarFilters();
    initReportFilters();
    await initFilterOptions();
    loadPending();
}

async function initFilterOptions() {
    const { data: groups } = await supabaseClient.from('groups').select('*');
    const { data: projects } = await supabaseClient.from('projects').select('*');

    ['calendar', 'report'].forEach(type => {
        const gSel = document.getElementById(`${type}-group-filter`);
        const pSel = document.getElementById(`${type}-project-filter`);
        if (!gSel || !pSel) return;

        gSel.innerHTML = '<option value="">All Groups</option>';
        pSel.innerHTML = '<option value="">All Projects</option>';

        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id; opt.textContent = g.name;
            gSel.appendChild(opt);
        });

        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name;
            pSel.appendChild(opt);
        });
    });
}

function initCalendarFilters() {
    const yearSelect = document.getElementById('calendar-year');
    const monthSelect = document.getElementById('calendar-month');
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    monthSelect.value = now.getMonth();
}

function initReportFilters() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('report-start').value = firstDay;
    document.getElementById('report-end').value = lastDay;
}

// --- 3. Manage Pending Approvals ---
async function loadPending() {
    const tbody = document.getElementById('pending-body');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    const { data, error } = await supabaseClient.from('leaves').select('*, users(name)').eq('status', 'Pending');
    if (error) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No pending applications.</td></tr>';
        return;
    }
    data.forEach(l => {
        const name = l.users ? l.users.name : 'Unknown';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${name}</td><td>${l.start_date} ~ ${l.end_date}</td><td>${l.days}</td><td>${l.reason || '-'}</td>
            <td>
                <button class="btn btn-primary" onclick="updateStatus(${l.id}, 'Approved')" style="padding: 5px 10px; background: #00B42A; font-size: 12px;">Approve</button>
                <button class="btn btn-primary" onclick="updateStatus(${l.id}, 'Rejected')" style="padding: 5px 10px; background: #F53F3F; font-size: 12px;">Reject</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

async function updateStatus(id, newStatus) {
    if (!id || id === 'null') return;
    const { error } = await supabaseClient.from('leaves').update({ status: newStatus }).eq('id', id);
    if (!error) { alert('Status updated!'); loadPending(); }
}

// --- 4. Enhanced Calendar Generator ---
async function loadCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const year = parseInt(document.getElementById('calendar-year').value);
    const month = parseInt(document.getElementById('calendar-month').value);
    const groupF = document.getElementById('calendar-group-filter').value;
    const projectF = document.getElementById('calendar-project-filter').value;

    const firstDayValue = new Date(year, month, 1).getDay();
    const offset = (firstDayValue === 0) ? 6 : firstDayValue - 1;
    for (let j = 0; j < offset; j++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day';
        emptyDiv.style.background = 'var(--bg-color)';
        grid.appendChild(emptyDiv);
    }

    // 抓取假單及其關聯用戶的群組/專案
    const { data: leaves } = await supabaseClient
        .from('leaves')
        .select('*, users(name, color, user_groups(group_id), user_projects(project_id))')
        .eq('status', 'Approved');

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerHTML = `<strong>${i}</strong>`;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        leaves.filter(l => {
            const inDate = dateStr >= l.start_date && dateStr <= l.end_date;
            if (!inDate) return false;

            // 關鍵篩選邏輯
            let groupMatch = !groupF || (l.users.user_groups && l.users.user_groups.some(ug => ug.group_id == groupF));
            let projectMatch = !projectF || (l.users.user_projects && l.users.user_projects.some(up => up.project_id == projectF));

            return groupMatch && projectMatch;
        }).forEach(l => {
            const tag = document.createElement('span');
            tag.className = 'leave-tag';
            tag.style.cursor = 'pointer';
            tag.innerText = l.users ? l.users.name : 'Unknown';
            if (l.users && l.users.color) tag.style.backgroundColor = l.users.color;
            tag.onclick = () => showLeaveDetails(l.id);
            dayDiv.appendChild(tag);
        });
        grid.appendChild(dayDiv);
    }
}

async function showLeaveDetails(leaveId) {
    const { data: l } = await supabaseClient.from('leaves').select('*, users(name)').eq('id', leaveId).single();
    if (!l) return;
    document.getElementById('modal-user').innerText = l.users ? l.users.name : 'Unknown';
    document.getElementById('modal-date').innerText = `${l.start_date} ~ ${l.end_date}`;
    document.getElementById('modal-days').innerText = `${l.days} days`;
    document.getElementById('modal-reason').innerText = l.reason || '(No reason)';
    document.getElementById('leave-modal').style.display = 'flex';
}

function closeModal() { document.getElementById('leave-modal').style.display = 'none'; }
function closeGroupModal() { document.getElementById('group-assign-modal').style.display = 'none'; }
function closeProjectModal() { document.getElementById('project-assign-modal').style.display = 'none'; }

// --- 5. Enhanced Dynamic Reports (顯示該團隊所有同事) ---
async function loadReport() {
    const start = document.getElementById('report-start').value;
    const end = document.getElementById('report-end').value;
    const groupF = document.getElementById('report-group-filter').value;
    const projectF = document.getElementById('report-project-filter').value;
    const tbody = document.getElementById('report-table-body');

    if (!start || !end) return;
    tbody.innerHTML = '<tr><td colspan="3">Processing report...</td></tr>';

    // 1. 先獲取 符合篩選條件的「所有同事」
    let userQuery = supabaseClient.from('users').select('*, user_groups(group_id), user_projects(project_id)').eq('is_active', true);
    const { data: allUsers } = await userQuery;

    // 前端過濾符合 Group/Project 的同事
    const targetUsers = allUsers.filter(u => {
        let groupMatch = !groupF || (u.user_groups && u.user_groups.some(ug => ug.group_id == groupF));
        let projectMatch = !projectF || (u.user_projects && u.user_projects.some(up => up.project_id == projectF));
        return groupMatch && projectMatch;
    });

    if (targetUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No colleagues found in this group/project.</td></tr>';
        return;
    }

    // 2. 獲取選取日期區間內的假單
    const { data: leaves, error } = await supabaseClient.from('leaves')
        .select('*')
        .eq('status', 'Approved')
        .gte('start_date', start)
        .lte('start_date', end);

    if (error) return;

    // 3. 建立報表數據
    const userStats = {};
    targetUsers.forEach(u => {
        userStats[u.id] = { name: u.name, totalDays: 0, count: 0 };
    });

    leaves.forEach(l => {
        if (userStats[l.user_id]) {
            userStats[l.user_id].totalDays += parseFloat(l.days);
            userStats[l.user_id].count += 1;
        }
    });

    // 4. 渲染表格
    tbody.innerHTML = '';
    Object.values(userStats).sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${s.name}</strong></td>
            <td>${s.totalDays.toFixed(1)} days</td>
            <td>${s.count} times</td>`;
        tbody.appendChild(tr);
    });
}

// --- 6. User Management ---
async function loadUsers() {
    const { data: users } = await supabaseClient.from('users')
        .select('*, user_groups(groups(name)), user_projects(projects(name))')
        .order('id');
    const tbody = document.getElementById('user-mgr-body');
    tbody.innerHTML = '';
    users.forEach(u => {
        const groupTags = u.user_groups.map(ug => ug.groups ? `<span class="group-pill">${ug.groups.name}</span>` : '').join('');
        const projectTags = u.user_projects.map(up => up.projects ? `<span class="project-pill">${up.projects.name}</span>` : '').join('');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="font-weight:600">${u.name}</span> <i class="ph ph-note-pencil" style="cursor:pointer;color:var(--primary-color)" onclick="renameUser(${u.id}, '${u.name}')"></i></td>
            <td>${u.annual_leave_total} days</td>
            <td>${groupTags}</td><td>${projectTags}</td>
            <td><input type="color" value="${u.color || '#0052D9'}" onchange="updateUserColor(${u.id}, this.value)"></td>
            <td>${u.is_active ? '<span style="color: green">Active</span>' : '<span style="color: red">Disabled</span>'}</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button onclick="toggleUser(${u.id}, ${u.is_active})" class="btn" style="padding: 4px; font-size: 10px;">En/Disable</button>
                    <button onclick="manageUserGroups(${u.id}, '${u.name}')" class="btn" style="padding: 4px; font-size: 10px; background: #666; color: white;">Grp</button>
                    <button onclick="manageUserProjects(${u.id}, '${u.name}')" class="btn" style="padding: 4px; font-size: 10px; background: #059669; color: white;">Prj</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

async function manageUserGroups(userId, userName) {
    const tbody = document.getElementById('group-table-selection-body');
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    document.getElementById('target-user-name').innerText = `Manage Groups for ${userName}`;
    const { data: groups } = await supabaseClient.from('groups').select('*');
    const { data: currentLinks } = await supabaseClient.from('user_groups').select('group_id').eq('user_id', userId);
    const existingGroupIds = (currentLinks || []).map(l => l.group_id);
    tbody.innerHTML = '';
    groups.forEach(g => {
        const tr = document.createElement('tr');
        const checked = existingGroupIds.includes(g.id) ? 'checked' : '';
        tr.innerHTML = `<td style="text-align:center"><input type="checkbox" class="group-select-chk" id="chkg-${g.id}" value="${g.id}" ${checked}></td>
            <td><label for="chkg-${g.id}" style="cursor:pointer;display:block">${g.name}</label></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('save-groups-btn').onclick = () => saveUserGroups(userId);
    document.getElementById('group-assign-modal').style.display = 'flex';
}

async function saveUserGroups(userId) {
    const checkedIds = Array.from(document.querySelectorAll('.group-select-chk:checked')).map(c => parseInt(c.value));
    await supabaseClient.from('user_groups').delete().eq('user_id', userId);
    if (checkedIds.length > 0) {
        await supabaseClient.from('user_groups').insert(checkedIds.map(gid => ({ user_id: userId, group_id: gid })));
    }
    closeGroupModal(); loadUsers();
}

async function manageUserProjects(userId, userName) {
    const tbody = document.getElementById('project-table-selection-body');
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    document.getElementById('target-project-user-name').innerText = `Manage Projects for ${userName}`;
    const { data: projects } = await supabaseClient.from('projects').select('*');
    const { data: currentLinks } = await supabaseClient.from('user_projects').select('project_id').eq('user_id', userId);
    const existingIds = (currentLinks || []).map(l => l.project_id);
    tbody.innerHTML = '';
    projects.forEach(p => {
        const tr = document.createElement('tr');
        const checked = existingIds.includes(p.id) ? 'checked' : '';
        tr.innerHTML = `<td style="text-align:center"><input type="checkbox" class="project-select-chk" id="chkp-${p.id}" value="${p.id}" ${checked}></td>
            <td><label for="chkp-${p.id}" style="cursor:pointer;display:block">${p.name}</label></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('save-projects-btn').onclick = () => saveUserProjects(userId);
    document.getElementById('project-assign-modal').style.display = 'flex';
}

async function saveUserProjects(userId) {
    const checkedIds = Array.from(document.querySelectorAll('.project-select-chk:checked')).map(c => parseInt(c.value));
    await supabaseClient.from('user_projects').delete().eq('user_id', userId);
    if (checkedIds.length > 0) {
        await supabaseClient.from('user_projects').insert(checkedIds.map(pid => ({ user_id: userId, project_id: pid })));
    }
    closeProjectModal(); loadUsers();
}

async function updateUserColor(userId, newColor) { await supabaseClient.from('users').update({ color: newColor }).eq('id', userId); }
async function renameUser(id, old) {
    const name = prompt('Rename:', old);
    if (name && name !== old) { await supabaseClient.from('users').update({ name }).eq('id', id); loadUsers(); }
}

// --- 7. Group & Project Masters ---
async function loadGroups() {
    const { data } = await supabaseClient.from('groups').select('*').order('id');
    const tbody = document.getElementById('group-mgr-body');
    tbody.innerHTML = data.map(g => `<tr><td>${g.name}</td><td>
        <button class="btn" onclick="renameGroup(${g.id},'${g.name}')">Rename</button>
        <button class="btn" style="color:red" onclick="deleteGroup(${g.id})">Del</button></td></tr>`).join('');
}
async function addGroup() { const name = prompt('Name:'); if (name) { await supabaseClient.from('groups').insert([{ name }]); loadGroups(); } }
async function renameGroup(id, old) { const name = prompt('Rename:', old); if (name && name !== old) { await supabaseClient.from('groups').update({ name }).eq('id', id); loadGroups(); } }
async function deleteGroup(id) { if (confirm('Delete?')) { await supabaseClient.from('groups').delete().eq('id', id); loadGroups(); } }

async function loadProjects() {
    const { data } = await supabaseClient.from('projects').select('*').order('id');
    const tbody = document.getElementById('project-mgr-body');
    tbody.innerHTML = data.map(p => `<tr><td>${p.name}</td><td>
        <button class="btn" onclick="renameProject(${p.id},'${p.name}')">Rename</button>
        <button class="btn" style="color:red" onclick="deleteProject(${p.id})">Del</button></td></tr>`).join('');
}
async function addProject() { const name = prompt('Name:'); if (name) { await supabaseClient.from('projects').insert([{ name }]); loadProjects(); } }
async function renameProject(id, old) { const name = prompt('Rename:', old); if (name && name !== old) { await supabaseClient.from('projects').update({ name }).eq('id', id); loadProjects(); } }
async function deleteProject(id) { if (confirm('Delete?')) { await supabaseClient.from('projects').delete().eq('id', id); loadProjects(); } }

async function toggleUser(id, stat) { await supabaseClient.from('users').update({ is_active: !stat }).eq('id', id); loadUsers(); }
async function showAddUser() { const name = prompt('Name:'); if (name) { await supabaseClient.from('users').insert([{ name, annual_leave_total: 12, is_active: true, color: '#0052D9' }]); loadUsers(); } }

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) { closeModal(); closeGroupModal(); closeProjectModal(); }
}
