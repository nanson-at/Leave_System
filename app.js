/**
 * LeaveSmart - Multi-Language Application System
 */

const supabaseClient = (typeof window !== 'undefined' && window.supabase) ?
    window.supabase.createClient('https://jylruqsfrosqgrbwiwyy.supabase.co', 'sb_publishable_KhmtGP8jm4koH21QXMMSjw_jaLDq8RE') :
    null;

// --- i18n Dictionary ---
const translations = {
    'en': {
        'admin_portal': 'Admin Portal',
        'today_leaves_title': 'Today\'s Leaves',
        'loading': 'Loading...',
        'welcome_select': 'Welcome! Please select your name:',
        'select_colleague': 'Select Colleague...',
        'leave_remaining': 'Leave Balance',
        'pending_status': 'Pending Items',
        'monthly_used': 'Used (Month)',
        'apply_leave_title': 'Apply for Leave',
        'leave_type_label': 'Leave Type',
        'type_annual': 'Annual Leave',
        'type_sick': 'Sick Leave',
        'type_personal': 'Personal Leave',
        'type_comp': 'Compensation Leave',
        'start_date': 'Start Date',
        'end_date': 'End Date',
        'leave_days': 'Leave Days',
        'reason_label': 'Reason (Optional)',
        'reason_placeholder': 'Enter reason...',
        'submit_btn': 'Submit Application',
        'history_title': 'Application History',
        'th_date': 'Apply Date',
        'th_type': 'Type',
        'th_days': 'Days',
        'th_status': 'Status',
        'th_remark': 'Remark',
        'select_to_view': 'Select a colleague to view records.',
        'no_one_today': 'No one is on leave today.',
        'submitting': 'Submitting...',
        'submit_success': 'Success!',
        'status_approved': 'Approved',
        'status_pending': 'Pending',
        'status_rejected': 'Rejected'
    },
    'zh-HK': {
        'admin_portal': '管理員後台',
        'today_leaves_title': '今日放假同事',
        'loading': '載入中...',
        'welcome_select': '歡迎使用！請選擇你的姓名：',
        'select_colleague': '請選擇同事...',
        'leave_remaining': '年假剩餘',
        'pending_status': '待處理',
        'monthly_used': '本月已休',
        'apply_leave_title': '提交請假申請',
        'leave_type_label': '請假類型',
        'type_annual': '年假 (Annual)',
        'type_sick': '病假 (Sick)',
        'type_personal': '事假 (Personal)',
        'type_comp': '補假 (Compens.)',
        'start_date': '開始日期',
        'end_date': '結束日期',
        'leave_days': '請假天數',
        'reason_label': '請假理由 (選填)',
        'reason_placeholder': '請輸入理由...',
        'submit_btn': '提交申請',
        'history_title': '最近申請紀錄',
        'th_date': '申請日期',
        'th_type': '類型',
        'th_days': '天數',
        'th_status': '狀態',
        'th_remark': '備註',
        'select_to_view': '請選擇同事以查看紀錄',
        'no_one_today': '今天暫無同事放假',
        'submitting': '提交中...',
        'submit_success': '提交成功！',
        'status_approved': '已核准',
        'status_pending': '審核中',
        'status_rejected': '已拒絕'
    },
    'zh-CN': {
        'admin_portal': '管理员后台',
        'today_leaves_title': '今日放假同事',
        'loading': '加载中...',
        'welcome_select': '欢迎使用！请选择你的姓名：',
        'select_colleague': '请选择同事...',
        'leave_remaining': '年假剩余',
        'pending_status': '待处理',
        'monthly_used': '本月已休',
        'apply_leave_title': '提交请假申请',
        'leave_type_label': '请假类型',
        'type_annual': '年假 (Annual)',
        'type_sick': '病假 (Sick)',
        'type_personal': '事假 (Personal)',
        'type_comp': '补假 (Compens.)',
        'start_date': '开始日期',
        'end_date': '结束日期',
        'leave_days': '请假天数',
        'reason_label': '请假理由 (选填)',
        'reason_placeholder': '请输入理由...',
        'submit_btn': '提交申请',
        'history_title': '最近申请记录',
        'th_date': '申请日期',
        'th_type': '类型',
        'th_days': '天数',
        'th_status': '状态',
        'th_remark': '备注',
        'select_to_view': '请选择同事以查看记录',
        'no_one_today': '今天暂无同事放假',
        'submitting': '提交中...',
        'submit_success': '提交成功！',
        'status_approved': '已核准',
        'status_pending': '审核中',
        'status_rejected': '已拒绝'
    }
};

let currentLang = localStorage.getItem('lang') || 'en';
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Set language & Highlight button
    changeLanguage(currentLang);
    
    // 2. Load basic data
    loadUsers(); 
    loadTodayOnLeave(); 
    setupListeners();
});

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    const dict = translations[lang];

    // Update Button Highlight
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btn-lang-${lang}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Translate standard tags
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerText = dict[key];
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.placeholder = dict[key];
    });

    // Refresh data displays to update translated status terms
    if (currentUserId) {
        loadLeaveStats();
        loadHistory();
    }
    loadTodayOnLeave();
}

async function loadUsers() {
    const userSelect = document.getElementById('user-select');
    try {
        const { data, error } = await supabaseClient.from('users').select('*').eq('is_active', true).order('name', { ascending: true });
        if (error) throw error;
        data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            userSelect.appendChild(option);
        });
    } catch (err) { console.error('Fetch users error:', err); }
}

function setupListeners() {
    document.getElementById('user-select').addEventListener('change', (e) => {
        currentUserId = e.target.value;
        if (currentUserId) { loadLeaveStats(); loadHistory(); }
    });

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.addEventListener('change', (e) => {
        const startVal = e.target.value;
        if (startVal) {
            endDateInput.min = startVal;
            if (endDateInput.value && endDateInput.value < startVal) endDateInput.value = startVal;
        }
        updateAutoDays();
    });
    endDateInput.addEventListener('change', updateAutoDays);

    document.getElementById('leave-form').addEventListener('submit', handleFormSubmit);
}

function updateAutoDays() {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    if (start && end) {
        const days = getBusinessDays(new Date(start), new Date(end));
        document.getElementById('leave-days').value = days;
    }
}

function getBusinessDays(startDate, endDate) {
    let count = 0;
    let curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}

async function loadLeaveStats() {
    const { data: user } = await supabaseClient.from('users').select('*').eq('id', currentUserId).single();
    const { data: leaves } = await supabaseClient.from('leaves').select('*').eq('user_id', currentUserId);
    
    const now = new Date();
    let yearlyApprovedTotal = 0;
    let monthlyApprovedTotal = 0;
    let pendingCount = 0;

    leaves.forEach(l => {
        const lDate = new Date(l.apply_date);
        if (l.status === 'Pending') pendingCount++;
        if (l.status === 'Approved' && lDate.getFullYear() === now.getFullYear()) {
            yearlyApprovedTotal += parseFloat(l.days);
            if (lDate.getMonth() === now.getMonth()) monthlyApprovedTotal += parseFloat(l.days);
        }
    });

    document.getElementById('annual-leave-balance').innerText = (user.annual_leave_total - yearlyApprovedTotal).toString();
    document.getElementById('pending-count').innerText = pendingCount.toString();
    document.getElementById('monthly-used').innerText = monthlyApprovedTotal.toString();
}

async function loadHistory() {
    const tbody = document.getElementById('history-body');
    const { data } = await supabaseClient.from('leaves').select('*').eq('user_id', currentUserId).order('apply_date', { ascending: false });
    
    tbody.innerHTML = '';
    const dict = translations[currentLang];
    
    data.forEach(l => {
        const tr = document.createElement('tr');
        // Translate status
        const displayStatus = dict['status_' + l.status.toLowerCase()] || l.status;
        tr.innerHTML = `
            <td>${l.apply_date}</td>
            <td>${l.type}</td>
            <td>${l.days}</td>
            <td><span class="status-badge status-${l.status.toLowerCase()}">${displayStatus}</span></td>
            <td>${l.reason || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadTodayOnLeave() {
    const listContainer = document.getElementById('today-list');
    const dict = translations[currentLang];
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabaseClient.from('leaves').select('*, users(name)').eq('status', 'Approved').lte('start_date', today).gte('end_date', today);

    if (!data || data.length === 0) {
        listContainer.innerHTML = `<div class="no-leave">${dict['no_one_today']}</div>`;
        return;
    }

    listContainer.innerHTML = '';
    data.forEach(l => {
        const div = document.createElement('div');
        div.className = 'today-person animate-fade';
        div.innerHTML = `<i class="ph-bold ph-user-circle"></i> <span>${l.users.name}</span>`;
        listContainer.appendChild(div);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const dict = translations[currentLang];
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = dict['submitting'];

    const formData = {
        user_id: currentUserId,
        type: document.getElementById('leave-type').value,
        start_date: document.getElementById('start-date').value,
        end_date: document.getElementById('end-date').value,
        days: document.getElementById('leave-days').value,
        reason: document.getElementById('reason').value,
        status: 'Pending',
        apply_date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabaseClient.from('leaves').insert([formData]);
    if (!error) {
        alert(dict['submit_success']);
        e.target.reset();
        loadLeaveStats(); loadHistory();
    }
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt"></i> <span>${dict['submit_btn']}</span>`;
}
