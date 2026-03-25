// ============================================================
// 主页逻辑 (index.html)
// ============================================================

let startDate = getTodayStr();
let endDate = getTodayStr();
let currentDate = getTodayStr(); // 保留兼容
let adminUser = null;
let classesData = [];
let currentSubject = null;       // 当前选中科目，null 表示全部
let visibleClassIds = null;      // null 表示全部可见
let visibleSubjects = null;      // null 表示全部科目可见，数组表示选中的科目名列表
let legendVisible = true;

// 工具函数：格式化日期为 YYYY-MM-DD
function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// 工具函数：格式化日期显示
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

// 获取周几名称
function getWeekdayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[d.getDay()];
}

// 格式化日期显示（含周几）
function formatDateWithWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth()+1}月${d.getDate()}日(${getWeekdayName(dateStr)})`;
}

// 日期加减天数（用本地时间格式化，避免时区偏移导致日期错误）
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

// Toast 提示
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// 打开开始日期选择器
function openStartDatePicker() {
  const picker = document.getElementById('start-date-picker');
  picker.value = startDate;
  picker.showPicker ? picker.showPicker() : picker.click();
}

// 打开结束日期选择器
function openEndDatePicker() {
  const picker = document.getElementById('end-date-picker');
  picker.value = endDate;
  picker.showPicker ? picker.showPicker() : picker.click();
}

// 开始日期变更
function onStartDateChange(val) {
  startDate = val;
  if (startDate > endDate) endDate = startDate;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// 结束日期变更
function onEndDateChange(val) {
  endDate = val;
  if (endDate < startDate) startDate = endDate;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// ◀ 左箭头：开始日期往前一天
function prevDate() {
  startDate = addDays(startDate, -1);
  if (startDate > endDate) endDate = startDate;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// ▶ 右箭头：结束日期往后一天
function nextDate() {
  endDate = addDays(endDate, 1);
  if (endDate < startDate) startDate = endDate;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// 快捷：跳到前一天（startDate=endDate=今天-1）
function goYesterday() {
  var d = addDays(startDate, -1);
  startDate = d;
  endDate = d;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// 快捷：跳到后一天（startDate=endDate=今天+1）
function goTomorrow() {
  var d = addDays(endDate, 1);
  startDate = d;
  endDate = d;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// 快捷：跳到今天
function goToday() {
  var today = new Date();
  var y = today.getFullYear();
  var m = String(today.getMonth() + 1).padStart(2, '0');
  var dd = String(today.getDate()).padStart(2, '0');
  startDate = y + '-' + m + '-' + dd;
  endDate = startDate;
  currentDate = startDate;
  updateDateDisplay();
  loadClassCards();
}

// 更新日期显示
function updateDateDisplay() {
  document.getElementById('start-date-text').textContent = formatDateWithWeekday(startDate);
  document.getElementById('end-date-text').textContent = formatDateWithWeekday(endDate);
}

// ============================================================
// 科目标签
// ============================================================
function renderSubjectTabs() {
  var container = document.getElementById('subject-tabs');
  // 根据 visibleSubjects 过滤要显示的科目
  var allSubjectNames = CONFIG.subjects.map(function(s) { return s.name; });
  var effectiveSubjects = visibleSubjects || allSubjectNames;
  var filteredSubjects = CONFIG.subjects.filter(function(s) { return effectiveSubjects.indexOf(s.name) !== -1; });

  var allBtn = '<button class="hw-tab ' + (currentSubject === null ? 'active' : '') + '" onclick="switchSubject(null)" style="flex-shrink:0;">全部</button>';

  var subjectBtns = filteredSubjects.map(function(s) {
    return '<button class="hw-tab ' + (currentSubject === s.name ? 'active' : '') + '" onclick="switchSubject(\'' + s.name + '\')" style="flex-shrink:0;">' + s.icon + ' ' + s.name + '</button>';
  }).join('');

  container.innerHTML = allBtn + subjectBtns;

  // 如果当前选中的科目被筛选掉了，自动切换到"全部"
  if (currentSubject !== null && effectiveSubjects.indexOf(currentSubject) === -1) {
    currentSubject = null;
    renderSubjectTabs();
    loadClassCards();
  }
}

function switchSubject(name) {
  currentSubject = name;
  renderSubjectTabs();
  loadClassCards();
}

// ============================================================
// 班级筛选面板
// ============================================================
function loadVisibleClasses() {
  const saved = localStorage.getItem(CONFIG.storageKeys.visibleClasses);
  if (saved) {
    try {
      visibleClassIds = JSON.parse(saved);
    } catch(e) {
      visibleClassIds = null;
    }
  }
}

function saveVisibleClasses() {
  if (visibleClassIds === null) {
    localStorage.removeItem(CONFIG.storageKeys.visibleClasses);
  } else {
    localStorage.setItem(CONFIG.storageKeys.visibleClasses, JSON.stringify(visibleClassIds));
  }
}

function toggleFilterPanel() {
  var panel = document.getElementById('filter-panel');
  var overlay = document.getElementById('filter-overlay');
  var isVisible = panel.style.display !== 'none';
  if (isVisible) {
    panel.style.display = 'none';
    overlay.style.display = 'none';
  } else {
    renderFilterCheckboxes();
    panel.style.display = 'block';
    overlay.style.display = 'block';
  }
}

function renderFilterCheckboxes() {
  var container = document.getElementById('filter-checkboxes');
  var effectiveVisible = visibleClassIds || classesData.map(function(c) { return c.id; });
  container.innerHTML = classesData.map(function(cls) {
    var checked = effectiveVisible.indexOf(cls.id) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:6px 10px; border-radius:16px; border:1.5px solid ' + (checked ? 'var(--primary)' : 'var(--border)') + '; background:' + (checked ? 'var(--primary-light)' : '#fff') + '; cursor:pointer; font-size:13px; color:' + (checked ? 'var(--primary)' : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onClassFilterChange(' + cls.id + ', this.checked)" style="display:none;">' +
      cls.name +
      '</label>';
  }).join('');
  // 同时渲染科目筛选复选框
  renderSubjectFilterCheckboxes();
}

function onClassFilterChange(classId, checked) {
  if (visibleClassIds === null) {
    visibleClassIds = classesData.map(function(c) { return c.id; });
  }
  if (checked) {
    if (visibleClassIds.indexOf(classId) === -1) visibleClassIds.push(classId);
  } else {
    visibleClassIds = visibleClassIds.filter(function(id) { return id !== classId; });
  }
  // 如果全部选中，重置为 null
  if (visibleClassIds.length === classesData.length) visibleClassIds = null;
  saveVisibleClasses();
  renderFilterCheckboxes();
  loadClassCards();
  updateFilterBtnHighlight();
}

function selectAllClasses() {
  visibleClassIds = null;
  saveVisibleClasses();
  renderFilterCheckboxes();
  loadClassCards();
  updateFilterBtnHighlight();
}

function clearAllClasses() {
  visibleClassIds = [];
  saveVisibleClasses();
  renderFilterCheckboxes();
  loadClassCards();
  updateFilterBtnHighlight();
}

// ============================================================
// 科目筛选面板
// ============================================================
function loadVisibleSubjects() {
  var saved = localStorage.getItem(CONFIG.storageKeys.visibleSubjects);
  if (saved) {
    try {
      visibleSubjects = JSON.parse(saved);
    } catch(e) {
      visibleSubjects = null;
    }
  }
}

function saveVisibleSubjects() {
  if (visibleSubjects === null) {
    localStorage.removeItem(CONFIG.storageKeys.visibleSubjects);
  } else {
    localStorage.setItem(CONFIG.storageKeys.visibleSubjects, JSON.stringify(visibleSubjects));
  }
}

function renderSubjectFilterCheckboxes() {
  var container = document.getElementById('filter-subject-checkboxes');
  if (!container) return;
  var allSubjectNames = CONFIG.subjects.map(function(s) { return s.name; });
  var effectiveVisible = visibleSubjects || allSubjectNames;
  container.innerHTML = CONFIG.subjects.map(function(s) {
    var checked = effectiveVisible.indexOf(s.name) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:6px 10px; border-radius:16px; border:1.5px solid ' + (checked ? s.color : 'var(--border)') + '; background:' + (checked ? s.color + '18' : '#fff') + '; cursor:pointer; font-size:13px; color:' + (checked ? s.color : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onSubjectFilterChange(\'' + s.name + '\', this.checked)" style="display:none;">' +
      s.icon + ' ' + s.name +
      '</label>';
  }).join('');
}

function onSubjectFilterChange(subjectName, checked) {
  var allSubjectNames = CONFIG.subjects.map(function(s) { return s.name; });
  if (visibleSubjects === null) {
    visibleSubjects = allSubjectNames.slice();
  }
  if (checked) {
    if (visibleSubjects.indexOf(subjectName) === -1) visibleSubjects.push(subjectName);
  } else {
    visibleSubjects = visibleSubjects.filter(function(n) { return n !== subjectName; });
  }
  // 如果全部选中，重置为 null
  if (visibleSubjects.length === allSubjectNames.length) visibleSubjects = null;
  saveVisibleSubjects();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  loadClassCards();
  updateFilterBtnHighlight();
}

function selectAllSubjects() {
  visibleSubjects = null;
  saveVisibleSubjects();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  loadClassCards();
  updateFilterBtnHighlight();
}

function clearAllSubjects() {
  visibleSubjects = [];
  saveVisibleSubjects();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  loadClassCards();
  updateFilterBtnHighlight();
}

// 更新筛选按钮高亮状态（班级或科目有筛选时高亮）
function updateFilterBtnHighlight() {
  var btn = document.getElementById('btn-filter');
  btn.style.color = (visibleClassIds !== null || visibleSubjects !== null) ? 'var(--primary)' : '';
}

// ============================================================
// 加载班级卡片
// ============================================================
async function loadClassCards() {
  const grid = document.getElementById('class-grid');
  grid.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"><div class="spinner"></div><span>加载中...</span></div>';

  try {
    if (classesData.length === 0) {
      classesData = await fetchClasses();
    }

    // 确定要显示的班级
    const effectiveVisible = visibleClassIds || classesData.map(c => c.id);
    const visibleClasses = classesData.filter(c => effectiveVisible.includes(c.id));

    if (visibleClasses.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>没有选中的班级<br>点击右上角筛选按钮添加</p></div>';
      document.getElementById('total-summary').textContent = '--';
      return;
    }

    // 获取日期范围内的记录
    const subject = currentSubject;
    const records = await fetchAllRecordsForDateRange(startDate, endDate, subject);

    // 根据科目筛选过滤记录
    var filteredRecords = records;
    if (visibleSubjects !== null && currentSubject === null) {
      filteredRecords = records.filter(function(r) {
        var hwName = r.homework_name || '';
        var subPrefix = hwName.indexOf('-') >= 0 ? hwName.split('-')[0] : '';
        return visibleSubjects.indexOf(subPrefix) !== -1;
      });
    }

    // 按日期分组
    var dateGroups = {};
    filteredRecords.forEach(function(r) {
      var d = r.date || '未知日期';
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(r);
    });

    // 获取所有日期并排序（降序，最新在前）
    var dates = Object.keys(dateGroups).sort().reverse();
    if (dates.length === 0) {
      // 没有记录时，至少显示一个日期分组
      dates = [startDate];
      dateGroups[startDate] = [];
    }

    var html = '';
    var grandTotalSubmitted = 0;
    var grandTotalCount = 0;
    var dateCount = 0;

    dates.forEach(function(date) {
      var dayRecords = dateGroups[date] || [];

      // 按班级×作业名分组统计
      var classHomeworkMap = {};
      dayRecords.forEach(function(r) {
        var classId = r.students ? r.students.class_id : null;
        if (!classId) return;
        if (!classHomeworkMap[classId]) classHomeworkMap[classId] = {};
        var hwName = r.homework_name || '未知作业';
        if (!classHomeworkMap[classId][hwName]) classHomeworkMap[classId][hwName] = { submitted: 0, total: 0 };
        classHomeworkMap[classId][hwName].total++;
        if (r.status === '已交' || r.status === '优秀') {
          classHomeworkMap[classId][hwName].submitted++;
        }
      });

      // 日期分组标题（显著的深色背景+大字体+周几）
      var isMultiDate = (startDate !== endDate);
      if (isMultiDate || dates.length > 1) {
        html += '<div style="grid-column:1/-1; background:var(--primary); color:#fff; padding:10px 16px; border-radius:12px; margin:8px 0 4px; font-size:15px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">';
        html += '<span>📅 ' + formatDateWithWeekday(date) + '</span>';
        // 当天汇总
        var daySubmitted = 0, dayTotal = 0;
        visibleClasses.forEach(function(cls) {
          var hwMap = classHomeworkMap[cls.id] || {};
          Object.values(hwMap).forEach(function(stat) {
            daySubmitted += stat.submitted;
            dayTotal += cls.student_count;
          });
        });
        var dayRate = dayTotal > 0 ? Math.round(daySubmitted / dayTotal * 100) : 0;
        html += '<span style="font-size:13px; opacity:0.9;">' + dayRate + '%</span>';
        html += '</div>';
      }

      // 渲染该日期下的班级卡片
      var subjectLabel = currentSubject ? currentSubject : '全部';
      visibleClasses.forEach(function(cls) {
        var hwMap = classHomeworkMap[cls.id] || {};
        var hwNames = Object.keys(hwMap).sort();
        var total = cls.student_count;

        var hwLines = '';
        if (hwNames.length === 0) {
          hwLines = '<div style="font-size:11px; color:#999; padding:2px 0;">暂无作业</div>';
        } else {
          hwLines = hwNames.map(function(hwName) {
            var stat = hwMap[hwName];
            var rate = total > 0 ? Math.round(stat.submitted / total * 100) : 0;
            var rateColor = rate >= 90 ? '#4caf50' : rate >= 70 ? '#ff9800' : '#f44336';
            var displayName = hwName;
            if (currentSubject) {
              displayName = hwName.indexOf('-') >= 0 ? hwName.slice(hwName.indexOf('-') + 1) : hwName;
            } else {
              var subPrefix = hwName.indexOf('-') >= 0 ? hwName.split('-')[0] : '';
              var subDef = CONFIG.subjects.find(function(s) { return s.name === subPrefix; });
              var hwShortName = hwName.indexOf('-') >= 0 ? hwName.slice(hwName.indexOf('-') + 1) : hwName;
              displayName = (subDef ? subDef.icon + ' ' : '') + (subPrefix ? subPrefix + '-' : '') + hwShortName;
            }
            return '<div style="display:flex; align-items:center; gap:4px; font-size:11px; padding:1px 0;">' +
              '<span style="flex:1; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + displayName + '</span>' +
              '<span style="color:' + rateColor + '; font-weight:600; flex-shrink:0;">' + stat.submitted + '/' + total + '</span>' +
              '</div>';
          }).join('');
        }

        var minRate = 100;
        hwNames.forEach(function(hwName) {
          var stat = hwMap[hwName];
          var rate = total > 0 ? Math.round(stat.submitted / total * 100) : 0;
          if (rate < minRate) minRate = rate;
        });
        if (hwNames.length === 0) minRate = 0;
        var barColor = minRate >= 90 ? '#4caf50' : minRate >= 70 ? '#ff9800' : '#f44336';

        html += '<a class="class-card" href="class.html?class=' + cls.id + '&date=' + date + '&subject=' + encodeURIComponent(currentSubject || CONFIG.subjects[0].name) + '" style="text-decoration:none;">';
        html += '<div class="class-name">' + cls.name + '</div>';
        html += '<div style="margin:4px 0;">' + hwLines + '</div>';
        html += '</a>';

        // 累计总体统计
        Object.values(hwMap).forEach(function(stat) {
          grandTotalSubmitted += stat.submitted;
          grandTotalCount += cls.student_count;
        });
      });

      if (Object.keys(classHomeworkMap).length > 0) dateCount++;
    });

    grid.innerHTML = html;

    // 更新总体统计（日均完成率）
    var totalRate = grandTotalCount > 0 ? Math.round(grandTotalSubmitted / grandTotalCount * 100) : 0;
    var subjectLabel = currentSubject ? currentSubject : '全部';
    var dateRangeLabel = startDate === endDate ? formatDateWithWeekday(startDate) : formatDateWithWeekday(startDate) + '~' + formatDateWithWeekday(endDate);
    document.getElementById('total-summary').textContent =
      subjectLabel + ' ' + grandTotalSubmitted + '/' + grandTotalCount + ' (' + totalRate + '%)';

  } catch(e) {
    console.error(e);
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>加载失败：' + e.message + '<br>请检查 Supabase 配置</p></div>';
  }
}

// ============================================================
// 管理员菜单
// ============================================================
function toggleAdminMenu() {
  var menu = document.getElementById('admin-menu');
  var isVisible = menu.style.display !== 'none';
  if (isVisible) {
    closeAdminMenu();
  } else {
    renderAdminMenu();
    menu.style.display = 'block';
  }
}

function closeAdminMenu() {
  var menu = document.getElementById('admin-menu');
  if (menu) menu.style.display = 'none';
}

// document 级点击：点击非菜单区域时关闭管理员菜单
document.addEventListener('click', function(e) {
  var menu = document.getElementById('admin-menu');
  var btn = document.getElementById('btn-admin-toggle');
  if (!menu || menu.style.display === 'none') return;
  if (btn && btn.contains(e.target)) return; // 点击按钮由 toggleAdminMenu 处理
  if (menu.contains(e.target)) return; // 点击菜单内部不关闭
  closeAdminMenu();
});

function renderAdminMenu() {
  var menu = document.getElementById('admin-menu');
  if (adminUser) {
    menu.innerHTML =
      '<div onclick="event.stopPropagation(); goToAdmin();" style="display:block; padding:12px 16px; font-size:14px; cursor:pointer; border-bottom:1px solid #f0f0f0; color:var(--text);">⚙️ 管理面板</div>' +
      '<div onclick="event.stopPropagation(); doLogout();" style="padding:12px 16px; font-size:14px; cursor:pointer; color:#f44336;">🚪 退出登录</div>';
  } else {
    menu.innerHTML =
      '<div onclick="event.stopPropagation(); doLogin();" style="padding:12px 16px; font-size:14px; cursor:pointer; color:var(--primary);">🔑 登录</div>';
  }
}

function goToAdmin() {
  closeAdminMenu();
  window.location.href = 'admin.html';
}

async function doLogout() {
  closeAdminMenu();
  try {
    await signOut();
    window.location.href = 'admin.html';
  } catch(e) {
    showToast('退出失败：' + e.message);
  }
}

function doLogin() {
  closeAdminMenu();
  window.location.href = 'admin.html';
}

function updateAdminUI() {
  var badge = document.getElementById('admin-badge');
  badge.style.display = adminUser ? 'inline-flex' : 'none';
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  const sb = initSupabase();
  if (!sb) return;

  // 从数据库动态加载科目列表，覆盖 config.js 中的静态配置
  try {
    var dbSubjects = await fetchSubjects();
    if (dbSubjects && dbSubjects.length > 0) {
      CONFIG.subjects = dbSubjects.map(function(s) {
        return { name: s.name, icon: s.icon || '', color: s.color || '#666666' };
      });
    }
  } catch(e) { console.error('加载科目失败', e); }

  // 从数据库动态加载状态列表，覆盖 config.js 中的静态配置
  try {
    var dbStatuses = await fetchStatuses();
    if (dbStatuses && dbStatuses.length > 0) {
      CONFIG.statuses = dbStatuses.map(function(s) {
        return {
          name: s.name,
          icon: s.icon || '',
          color: s.color || '#ffffff',
          textColor: s.text_color || '#333333',
          bgColor: s.bg_color || '#f0f0f0'
        };
      });
    }
  } catch(e) { console.error('加载状态失败', e); }

  // 强制登录检查：未登录跳转到登录页
  try {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) {
      window.location.href = 'admin.html?from=index';
      return;
    }
    adminUser = user;
  } catch(e) {
    window.location.href = 'admin.html?from=index';
    return;
  }

  // 设置日期显示
  updateDateDisplay();

  // 加载班级筛选状态和科目筛选状态
  loadVisibleClasses();
  loadVisibleSubjects();
  updateFilterBtnHighlight();

  // 检查管理员状态
  adminUser = await getCurrentUser();
  updateAdminUI();

  getSupabase().auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'admin.html';
      return;
    }
    adminUser = session?.user || null;
    updateAdminUI();
  });

  // btn-admin-toggle 的 onclick 已在 HTML 中设置为 toggleAdminMenu()

  // 渲染常驻筛选面板（班级+科目复选框）
  renderFilterCheckboxes();

  // 渲染科目标签
  renderSubjectTabs();

  // 加载班级卡片
  await loadClassCards();
}

document.addEventListener('DOMContentLoaded', init);