// ============================================================
// 班级详情页逻辑 (class.html)
// ============================================================

let currentClassId = null;
let currentDate = getTodayStr();
let currentSubject = CONFIG.subjects[0].name;  // 当前科目，默认语文
let currentHomeworkName = null;  // 当前作业完整名称，如"语文-默写"
let homeworkList = [];           // 当前科目下的作业列表（完整名称数组）
let studentsData = [];
let recordsMap = {};   // key: student_id, value: status
let adminUser = null;
let classesData = [];
let viewMode = 'number';   // 'number' 学号 | 'name' 姓名
let editingStudentId = null;  // 当前正在编辑姓名的学生ID

function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function openDatePicker() {
  const picker = document.getElementById('date-picker');
  picker.value = currentDate;
  picker.showPicker ? picker.showPicker() : picker.click();
}

function onDateChange(val) {
  currentDate = val;
  document.getElementById('date-text').textContent = formatDateDisplay(val);
  const url = new URL(window.location.href);
  url.searchParams.set('date', val);
  history.replaceState({}, '', url);
  currentHomeworkName = null;
  homeworkList = [];
  loadHomeworkList();
}

// ============================================================
// 班级标签渲染（与首页筛选联动）
// ============================================================
function renderClassTabs() {
  const container = document.getElementById('class-tabs');
  // 读取首页筛选状态，只显示已选中的班级
  let visibleIds = null;
  try {
    const saved = localStorage.getItem(CONFIG.storageKeys.visibleClasses);
    if (saved) visibleIds = JSON.parse(saved);
  } catch(e) {}
  // 合并 localStorage 筛选和 URL 参数筛选
  var effectiveIds = visibleClassIdsLocal || (visibleIds ? visibleIds : classesData.map(function(c) { return c.id; }));
  var visibleClasses = classesData.filter(function(c) { return effectiveIds.indexOf(c.id) !== -1; });
  container.innerHTML = visibleClasses.map(function(cls) {
    return '<button class="class-tab ' + (cls.id === currentClassId ? 'active' : '') + '" onclick="switchClass(' + cls.id + ')">' + cls.name + '</button>';
  }).join('');
}

async function switchClass(classId) {
  currentClassId = classId;
  currentHomeworkName = null;
  homeworkList = [];
  renderClassTabs();
  const url = new URL(window.location.href);
  url.searchParams.set('class', classId);
  history.replaceState({}, '', url);
  await loadHomeworkList();
}

// ============================================================
// 科目标签
// ============================================================
function renderSubjectTabs() {
  var container = document.getElementById('subject-tabs');
  // 根据 visibleSubjectsLocal 过滤科目
  var allSubjectNames = CONFIG.subjects.map(function(s) { return s.name; });
  var effectiveSubjects = visibleSubjectsLocal || allSubjectNames;
  var filteredSubjects = CONFIG.subjects.filter(function(s) { return effectiveSubjects.indexOf(s.name) !== -1; });

  container.innerHTML = filteredSubjects.map(function(s) {
    return '<button class="hw-tab ' + (s.name === currentSubject ? 'active' : '') + '" onclick="switchSubject(\'' + s.name + '\')" style="border-color:' + (s.name === currentSubject ? s.color : 'var(--border)') + '; color:' + (s.name === currentSubject ? s.color : 'var(--text-secondary)') + '; background:' + (s.name === currentSubject ? s.color + '18' : 'var(--bg)') + ';">' + s.icon + ' ' + s.name + '</button>';
  }).join('');

  // 如果当前选中的科目被筛选掉了，自动切换到第一个可见科目
  if (effectiveSubjects.indexOf(currentSubject) === -1 && filteredSubjects.length > 0) {
    switchSubject(filteredSubjects[0].name);
  }
}

async function switchSubject(name) {
  currentSubject = name;
  currentHomeworkName = null;
  homeworkList = [];
  renderSubjectTabs();
  const url = new URL(window.location.href);
  url.searchParams.set('subject', name);
  history.replaceState({}, '', url);
  await loadHomeworkList();
}

// ============================================================
// 作业子标签（同一科目下的多份作业）
// ============================================================
async function loadHomeworkList() {
  if (!currentClassId) return;
  try {
    homeworkList = await fetchHomeworkNamesForSubject(currentClassId, currentDate, currentSubject);
  } catch(e) {
    homeworkList = [];
  }
  // 默认选中第一份作业
  if (homeworkList.length > 0) {
    currentHomeworkName = homeworkList[0];
  } else {
    currentHomeworkName = null;
  }
  renderHomeworkTabs();
  await loadStudentGrid();
}

function renderHomeworkTabs() {
  const container = document.getElementById('homework-tabs');
  if (!container) return;
  const isAdmin = !!adminUser;

  if (homeworkList.length === 0) {
    // 无作业时显示提示 + 新增按钮（管理员）
    container.innerHTML = '<span style="font-size:12px; color:var(--text-secondary); padding:4px 8px;">暂无作业</span>' +
      (isAdmin ? '<button class="hw-tab-add" onclick="openAddHomework()" title="新增作业">＋</button>' : '');
    return;
  }

  var tabsHtml = homeworkList.map(function(hwName) {
    var isSelected = hwName === currentHomeworkName;
    // 显示去掉科目前缀后的短名
    var displayName = hwName.indexOf('-') >= 0 ? hwName.slice(hwName.indexOf('-') + 1) : hwName;
    return '<button class="hw-tab' + (isSelected ? ' active' : '') + '" onclick="switchHomework(\'' + hwName.replace(/'/g, "\\'") + '\')" ondblclick="renameHomework(\'' + hwName.replace(/'/g, "\\'") + '\')">' + displayName + '</button>';
  }).join('');

  const deleteBtn = (isAdmin && currentHomeworkName)
    ? '<button onclick="deleteCurrentHomework()" style="font-size:11px; padding:3px 8px; border-radius:10px; border:1px solid #f44336; background:none; color:#f44336; cursor:pointer; flex-shrink:0;" title="删除当前作业">删除</button>'
    : '';

  const addBtn = isAdmin
    ? '<button class="hw-tab-add" onclick="openAddHomework()" title="新增作业">＋</button>'
    : '';

  container.innerHTML = tabsHtml + addBtn + deleteBtn;
}

async function switchHomework(name) {
  currentHomeworkName = name;
  renderHomeworkTabs();
  await loadStudentGrid();
}

// ============================================================
// 新增作业弹窗
// ============================================================
function openAddHomework() {
  if (!adminUser) return;
  const modal = document.getElementById('add-homework-modal');
  document.getElementById('add-homework-input').value = '';
  // 更新弹窗提示文字，显示当前科目
  const hintEl = document.getElementById('add-homework-subject-hint');
  if (hintEl) hintEl.textContent = '当前科目：' + currentSubject;
  modal.style.display = 'flex';
  setTimeout(function() { document.getElementById('add-homework-input').focus(); }, 100);
}

function cancelAddHomework() {
  document.getElementById('add-homework-modal').style.display = 'none';
}

async function confirmAddHomework() {
  const inputName = document.getElementById('add-homework-input').value.trim();
  if (!inputName) { showToast('请输入作业名称'); return; }
  // 完整名称 = 科目-作业名
  const fullName = currentSubject + '-' + inputName;
  if (homeworkList.includes(fullName)) { showToast('该作业已存在'); return; }
  cancelAddHomework();
  // 新增作业：为所有学生创建"未交"记录（实际上只需切换到该作业，首次打开时无记录即为未交）
  // 直接将新作业加入列表并切换
  homeworkList.push(fullName);
  currentHomeworkName = fullName;
  renderHomeworkTabs();
  await loadStudentGrid();
  showToast('已新增作业：' + inputName);
}

// ============================================================
// 删除当前作业
// ============================================================
async function deleteCurrentHomework() {
  if (!adminUser || !currentHomeworkName) return;
  const displayName = currentHomeworkName.indexOf('-') >= 0 ? currentHomeworkName.slice(currentHomeworkName.indexOf('-') + 1) : currentHomeworkName;
  if (!confirm('确定删除作业「' + displayName + '」的所有记录？此操作不可恢复。')) return;
  try {
    await deleteHomeworkRecordsForName(currentClassId, currentDate, currentHomeworkName);
    homeworkList = homeworkList.filter(function(n) { return n !== currentHomeworkName; });
    currentHomeworkName = homeworkList.length > 0 ? homeworkList[0] : null;
    renderHomeworkTabs();
    await loadStudentGrid();
    showToast('已删除作业：' + displayName);
  } catch(e) {
    showToast('删除失败：' + e.message);
  }
}

// ============================================================
// 学号/姓名视图切换
// ============================================================
function toggleViewMode() {
  viewMode = viewMode === 'number' ? 'name' : 'number';
  localStorage.setItem(CONFIG.storageKeys.viewMode, viewMode);
  document.getElementById('btn-view-toggle').textContent = viewMode === 'number' ? '学号' : '姓名';
  renderStudentGrid();
}

// ============================================================
// 姓名编辑弹窗
// ============================================================
function openNameEdit(studentId) {
  if (!adminUser) return;
  editingStudentId = studentId;
  const student = studentsData.find(s => s.id === studentId);
  const modal = document.getElementById('name-edit-modal');
  document.getElementById('name-edit-title').textContent =
    `修改姓名（学号 ${student?.student_number}）`;
  document.getElementById('name-edit-input').value = student?.name || '';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('name-edit-input').focus(), 100);
}

function cancelNameEdit() {
  document.getElementById('name-edit-modal').style.display = 'none';
  editingStudentId = null;
}

async function confirmNameEdit() {
  if (!editingStudentId) return;
  const newName = document.getElementById('name-edit-input').value.trim();
  if (!newName) {
    showToast('姓名不能为空');
    return;
  }
  try {
    await updateStudentName(editingStudentId, newName);
    // 更新本地数据
    const student = studentsData.find(s => s.id === editingStudentId);
    if (student) student.name = newName;
    cancelNameEdit();
    renderStudentGrid();
    showToast('姓名已更新');
  } catch(e) {
    showToast('保存失败：' + e.message);
  }
}

// ============================================================
// 学生状态表格
// ============================================================
async function loadStudentGrid() {
  const grid = document.getElementById('student-grid');
  grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>加载中...</span></div>';
  document.getElementById('summary-bar').style.display = 'none';

  // 若无当前作业，显示提示
  if (!currentHomeworkName) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>请先选择或新增一份作业</p></div>';
    return;
  }

  try {
    studentsData = await fetchStudents(currentClassId);
    const records = await fetchHomeworkRecords(currentClassId, currentDate, currentHomeworkName);
    recordsMap = {};
    records.forEach(function(r) {
      recordsMap[r.student_id] = r.status;
    });
    renderStudentGrid();
    renderSummaryBar();
    // 显示筛选栏并重置筛选状态
    var filterBar = document.getElementById('status-filter-bar');
    if (filterBar) filterBar.style.display = 'flex';
    currentFilterStatus = '';
    var resultDiv = document.getElementById('filter-result-list');
    if (resultDiv) resultDiv.style.display = 'none';
    // 重置筛选按钮样式
    var filterBtns = document.querySelectorAll('.status-filter-btn');
    filterBtns.forEach(function(btn) {
      if (btn.getAttribute('data-filter') === '') {
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'var(--bg)';
        btn.style.color = 'var(--text-secondary)';
      }
    });
  } catch(e) {
    console.error(e);
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：' + e.message + '</p></div>';
  }
}

function renderStudentGrid() {
  const grid = document.getElementById('student-grid');
  const cols = CONFIG.columnsPerRow;
  const isAdmin = !!adminUser;
  const showName = viewMode === 'name';

  if (studentsData.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>该班级暂无学生数据</p></div>';
    return;
  }

  const rows = [];
  for (let i = 0; i < studentsData.length; i += cols) {
    rows.push(studentsData.slice(i, i + cols));
  }

  grid.style.gridTemplateColumns = '1fr';
  grid.innerHTML = rows.map(function(row) {
    const cells = row.map(function(student) {
      const status = recordsMap[student.id] || '未交';
      const statusDef = CONFIG.statuses.find(function(s) { return s.name === status; }) || CONFIG.statuses[0];
      // 未交状态显示"—"，让按钮有明显内容，易于点击
      const btnIcon = status === '未交' ? '—' : statusDef.icon;
      const labelText = showName
        ? (student.name || String(student.student_number))
        : student.student_number;
      const editBtn = (isAdmin && showName)
        ? '<button onclick="openNameEdit(' + student.id + ')" style="background:none;border:none;font-size:10px;cursor:pointer;color:var(--text-secondary);padding:0;line-height:1;" title="修改姓名">✏️</button>'
        : '';
      return '<div class="student-cell" style="flex-direction:column; align-items:center; gap:2px;">' +
        '<div style="display:flex; align-items:center; gap:2px; min-width:0;">' +
        '<span class="student-num" style="width:auto; max-width:52px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:' + (showName ? '10px' : '12px') + ';">' + labelText + '</span>' +
        editBtn +
        '</div>' +
        '<button class="status-btn ' + (isAdmin ? '' : 'readonly') + '" data-student-id="' + student.id + '" data-status="' + status + '" style="background:' + statusDef.bgColor + '; color:' + statusDef.textColor + '; border-color:' + (statusDef.bgColor === '#f0f0f0' ? '#ccc' : statusDef.bgColor) + '; border-style:' + (status === '未交' ? 'dashed' : 'solid') + '; width:100%; height:40px; border-radius:20px;" onclick="' + (isAdmin ? 'cycleStatus(this, ' + student.id + ')' : '') + '" title="' + status + '">' + btnIcon + '</button>' +
        '</div>';
    }).join('');
    return '<div class="student-row" style="display:grid; grid-template-columns:repeat(' + cols + ', 1fr); gap:4px;">' + cells + '</div>';
  }).join('');
}

// 作业重命名（双击作业标签触发）
async function renameHomework(oldName) {
  if (!adminUser) {
    showToast('请先登录管理员');
    return;
  }
  // 提取当前作业显示名（去掉科目前缀）
  var displayName = oldName.indexOf('-') >= 0 ? oldName.slice(oldName.indexOf('-') + 1) : oldName;
  var subjectPrefix = oldName.indexOf('-') >= 0 ? oldName.split('-')[0] : '';
  
  var newDisplayName = prompt('重命名作业（当天所有班级生效）：', displayName);
  if (!newDisplayName || newDisplayName === displayName) return;
  
  // 构建新的完整作业名
  var newFullName = subjectPrefix ? subjectPrefix + '-' + newDisplayName : newDisplayName;
  
  try {
    showToast('正在重命名...');
    await renameHomeworkRecords(currentDate, oldName, newFullName);
    showToast('重命名成功！');
    // 更新当前选中的作业名
    if (currentHomeworkName === oldName) {
      currentHomeworkName = newFullName;
    }
    // 重新加载作业列表
    await loadHomeworkList();
  } catch(e) {
    showToast('重命名失败：' + e.message);
  }
}

// 循环切换状态
async function cycleStatus(btn, studentId) {
  if (!adminUser) return;
  if (!currentHomeworkName) { showToast('请先选择作业'); return; }

  const currentStatus = btn.dataset.status;
  const statuses = CONFIG.statuses;
  const currentIdx = statuses.findIndex(function(s) { return s.name === currentStatus; });
  const nextIdx = (currentIdx + 1) % statuses.length;
  const nextStatus = statuses[nextIdx];
  const nextIcon = nextStatus.name === '未交' ? '—' : nextStatus.icon;

  // 乐观更新 UI
  btn.dataset.status = nextStatus.name;
  btn.style.background = nextStatus.bgColor;
  btn.style.color = nextStatus.textColor;
  btn.style.borderColor = nextStatus.bgColor === '#f0f0f0' ? '#ccc' : nextStatus.bgColor;
  btn.style.borderStyle = nextStatus.name === '未交' ? 'dashed' : 'solid';
  btn.textContent = nextIcon;
  btn.title = nextStatus.name;
  recordsMap[studentId] = nextStatus.name;
  renderSummaryBar();
  // 如果当前有筛选状态，实时刷新名单
  if (currentFilterStatus) {
    filterStudentsByStatus(currentFilterStatus);
  }

  try {
    await upsertHomeworkRecord(studentId, currentDate, currentHomeworkName, nextStatus.name, adminUser.email);
  } catch(e) {
    // 回滚
    const prevStatus = statuses[currentIdx];
    const prevIcon = prevStatus.name === '未交' ? '—' : prevStatus.icon;
    btn.dataset.status = prevStatus.name;
    btn.style.background = prevStatus.bgColor;
    btn.style.color = prevStatus.textColor;
    btn.style.borderColor = prevStatus.bgColor === '#f0f0f0' ? '#ccc' : prevStatus.bgColor;
    btn.style.borderStyle = prevStatus.name === '未交' ? 'dashed' : 'solid';
    btn.textContent = prevIcon;
    btn.title = prevStatus.name;
    recordsMap[studentId] = prevStatus.name;
    renderSummaryBar();
    if (currentFilterStatus) {
      filterStudentsByStatus(currentFilterStatus);
    }
    showToast('保存失败：' + e.message);
  }
}

// 渲染摘要条
function renderSummaryBar() {
  const summaryBar = document.getElementById('summary-bar');
  const rateEl = document.getElementById('summary-rate');
  const detailEl = document.getElementById('summary-detail');
  const total = studentsData.length;
  if (total === 0) return;

  const counts = {};
  CONFIG.statuses.forEach(function(s) { counts[s.name] = 0; });
  studentsData.forEach(function(student) {
    const status = recordsMap[student.id] || '未交';
    counts[status] = (counts[status] || 0) + 1;
  });

  const submitted = (counts['已交'] || 0) + (counts['优秀'] || 0);
  const rate = Math.round(submitted / total * 100);

  rateEl.textContent = rate + '%';
  detailEl.innerHTML = CONFIG.statuses.map(function(s) {
    if (!counts[s.name]) return '';
    return '<span style="color:' + (s.bgColor === '#f0f0f0' ? '#999' : s.bgColor) + '">' + (s.icon || s.name) + ' ' + counts[s.name] + '人</span>';
  }).join('');

  const subjectDef = CONFIG.subjects.find(function(s) { return s.name === currentSubject; });
  // 显示作业名称（去掉科目前缀）
  const hwDisplayName = currentHomeworkName
    ? (currentHomeworkName.indexOf('-') >= 0 ? currentHomeworkName.slice(currentHomeworkName.indexOf('-') + 1) : currentHomeworkName)
    : currentSubject;
  document.getElementById('completion-rate').textContent =
    (subjectDef ? subjectDef.icon : '') + ' ' + hwDisplayName + ' 已交 ' + submitted + '/' + total + ' (' + rate + '%)';

  summaryBar.style.display = 'flex';
}

// ============================================================
// 状态筛选与导出
// ============================================================
var currentFilterStatus = ''; // 当前筛选状态

function filterStudentsByStatus(status) {
  currentFilterStatus = status;

  // 更新筛选按钮样式
  var btns = document.querySelectorAll('.status-filter-btn');
  btns.forEach(function(btn) {
    if (btn.getAttribute('data-filter') === status) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'var(--bg)';
      btn.style.color = 'var(--text-secondary)';
    }
  });

  // 筛选学生
  var filteredStudents = [];
  studentsData.forEach(function(student) {
    var studentStatus = recordsMap[student.id] || '未交';
    if (!status || studentStatus === status) {
      filteredStudents.push(student);
    }
  });

  // 显示筛选结果名单
  var resultDiv = document.getElementById('filter-result-list');
  if (!status) {
    // "全部"模式：隐藏名单，显示所有学生格子
    resultDiv.style.display = 'none';
    // 恢复所有学生格子的显示和透明度
    var allCells = document.querySelectorAll('.student-cell');
    allCells.forEach(function(cell) { cell.style.display = ''; cell.style.opacity = '1'; });
  } else {
    // 筛选模式：显示匹配的学生名单
    if (filteredStudents.length === 0) {
      resultDiv.innerHTML = '<div style="color:#999; padding:4px 0;">没有' + status + '的学生</div>';
    } else {
      var statusDef = CONFIG.statuses.find(function(s) { return s.name === status; });
      var statusColor = statusDef ? (statusDef.bgColor === '#f0f0f0' ? '#666' : statusDef.bgColor) : '#333';
      var header = '<div style="font-weight:600; margin-bottom:6px; color:' + statusColor + ';">' +
        (statusDef ? statusDef.icon + ' ' : '') + status + '（' + filteredStudents.length + '人）</div>';
      var isAdmin = !!adminUser;
      var list = filteredStudents.map(function(student, idx) {
        var displayName = student.name || String(student.student_number);
        if (isAdmin) {
          return '<button onclick="quickSetStatus(' + student.id + ', \'已交\')" style="display:inline-block; padding:4px 10px; margin:2px; background:#fff; border-radius:10px; border:1px solid #e0e0e0; font-size:11px; cursor:pointer; -webkit-tap-highlight-color:transparent;" title="点击标记为已交">' +
            student.student_number + ' ' + displayName + '</button>';
        } else {
          return '<span style="display:inline-block; padding:2px 8px; margin:2px; background:#fff; border-radius:10px; border:1px solid #e0e0e0; font-size:11px;">' +
            student.student_number + ' ' + displayName + '</span>';
        }
      }).join('');
      resultDiv.innerHTML = header + '<div style="display:flex; flex-wrap:wrap; gap:2px;">' + list + '</div>';
    }
    resultDiv.style.display = 'block';

    // 高亮/隐藏学生格子
    var allCells = document.querySelectorAll('.student-cell');
    allCells.forEach(function(cell) {
      var btn = cell.querySelector('.status-btn');
      if (btn) {
        var cellStatus = btn.getAttribute('data-status');
        if (cellStatus === status) {
          cell.style.display = '';
          cell.style.opacity = '1';
        } else {
          cell.style.opacity = '0.2';
        }
      }
    });
  }
}

// 从筛选名单快速设置状态（点击名单中的学生标签时调用）
async function quickSetStatus(studentId, targetStatusName) {
  if (!adminUser) return;
  if (!currentHomeworkName) { showToast('请先选择作业'); return; }

  var targetStatus = CONFIG.statuses.find(function(s) { return s.name === targetStatusName; });
  if (!targetStatus) return;

  var prevStatusName = recordsMap[studentId] || '未交';

  // 乐观更新 recordsMap
  recordsMap[studentId] = targetStatusName;

  // 同步更新学生格子里的按钮 UI
  var btn = document.querySelector('.status-btn[data-student-id="' + studentId + '"]');
  if (btn) {
    var icon = targetStatusName === '未交' ? '—' : targetStatus.icon;
    btn.dataset.status = targetStatusName;
    btn.style.background = targetStatus.bgColor;
    btn.style.color = targetStatus.textColor;
    btn.style.borderColor = targetStatus.bgColor === '#f0f0f0' ? '#ccc' : targetStatus.bgColor;
    btn.style.borderStyle = targetStatusName === '未交' ? 'dashed' : 'solid';
    btn.textContent = icon;
    btn.title = targetStatusName;
  }

  // 重新渲染摘要条 + 筛选名单（将该学生从名单中移除）
  renderSummaryBar();
  filterStudentsByStatus(currentFilterStatus);

  // 持久化到数据库
  try {
    await upsertHomeworkRecord(studentId, currentDate, currentHomeworkName, targetStatusName, adminUser.email);
  } catch(e) {
    // 回滚
    var prevStatus = CONFIG.statuses.find(function(s) { return s.name === prevStatusName; }) || CONFIG.statuses[0];
    recordsMap[studentId] = prevStatusName;
    if (btn) {
      var prevIcon = prevStatusName === '未交' ? '—' : prevStatus.icon;
      btn.dataset.status = prevStatusName;
      btn.style.background = prevStatus.bgColor;
      btn.style.color = prevStatus.textColor;
      btn.style.borderColor = prevStatus.bgColor === '#f0f0f0' ? '#ccc' : prevStatus.bgColor;
      btn.style.borderStyle = prevStatusName === '未交' ? 'dashed' : 'solid';
      btn.textContent = prevIcon;
      btn.title = prevStatusName;
    }
    renderSummaryBar();
    filterStudentsByStatus(currentFilterStatus);
    showToast('保存失败：' + e.message);
  }
}

function exportStudentList() {
  if (!studentsData || studentsData.length === 0) {
    showToast('暂无学生数据');
    return;
  }

  // 获取当前班级名称
  var currentClass = classesData.find(function(c) { return c.id === currentClassId; });
  var className = currentClass ? currentClass.name : '未知班级';
  var hwDisplayName = currentHomeworkName
    ? (currentHomeworkName.indexOf('-') >= 0 ? currentHomeworkName.slice(currentHomeworkName.indexOf('-') + 1) : currentHomeworkName)
    : '全部';

  // 根据当前筛选状态决定导出内容
  var exportStudents = [];
  studentsData.forEach(function(student) {
    var studentStatus = recordsMap[student.id] || '未交';
    if (!currentFilterStatus || studentStatus === currentFilterStatus) {
      exportStudents.push({
        number: student.student_number,
        name: student.name || '',
        status: studentStatus
      });
    }
  });

  if (exportStudents.length === 0) {
    showToast('没有符合条件的学生');
    return;
  }

  // 生成 CSV 内容（兼容 Excel）
  var statusLabel = currentFilterStatus ? currentFilterStatus : '全部';
  var BOM = '\uFEFF'; // UTF-8 BOM，确保 Excel 正确识别中文
  var csv = BOM;

  // 添加上下文信息头
  csv += '# 导出信息\n';
  csv += '班级,' + className + '\n';
  csv += '日期,' + currentDate + '\n';
  csv += '科目,' + currentSubject + '\n';
  csv += '作业,' + hwDisplayName + '\n';
  csv += '筛选条件,' + statusLabel + '\n';
  csv += '导出人数,' + exportStudents.length + '人\n';
  csv += '导出时间,' + new Date().toLocaleString('zh-CN') + '\n';
  csv += '\n';

  // 数据表头和内容
  csv += '学号,姓名,' + currentSubject + '-' + hwDisplayName + ' 完成状态\n';
  exportStudents.forEach(function(s) {
    csv += s.number + ',' + s.name + ',' + s.status + '\n';
  });

  // 添加统计汇总
  csv += '\n';
  csv += '# 统计汇总\n';
  var totalCount = studentsData.length;
  var submittedCount = 0;
  var excellentCount = 0;
  var pendingCount = 0;
  studentsData.forEach(function(student) {
    var st = recordsMap[student.id] || '未交';
    if (st === '已交') submittedCount++;
    else if (st === '优秀') { submittedCount++; excellentCount++; }
    else pendingCount++;
  });
  csv += '全班总人数,' + totalCount + '\n';
  csv += '已交人数,' + submittedCount + '\n';
  csv += '其中优秀,' + excellentCount + '\n';
  csv += '未交人数,' + pendingCount + '\n';
  csv += '完成率,' + (totalCount > 0 ? Math.round(submittedCount / totalCount * 100) : 0) + '%\n';

  // 创建下载链接
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = className + '_' + currentSubject + '_' + hwDisplayName + '_' + statusLabel + '_' + currentDate + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('已导出 ' + exportStudents.length + ' 名学生名单');
}

// ============================================================
// 状态说明折叠
// ============================================================
let legendVisible = true;
function toggleLegend() {
  legendVisible = !legendVisible;
  document.getElementById('legend-content').style.display = legendVisible ? 'flex' : 'none';
  document.getElementById('legend-arrow').textContent = legendVisible ? '▾' : '▸';
}

// ============================================================
// 班级/科目筛选面板
// ============================================================
var visibleClassIdsLocal = null;  // 从 localStorage 读取
var visibleSubjectsLocal = null;  // 从 localStorage 读取

function loadFilterState() {
  var saved = localStorage.getItem(CONFIG.storageKeys.visibleClasses);
  if (saved) {
    try { visibleClassIdsLocal = JSON.parse(saved); } catch(e) { visibleClassIdsLocal = null; }
  }
  var savedSub = localStorage.getItem(CONFIG.storageKeys.visibleSubjects);
  if (savedSub) {
    try { visibleSubjectsLocal = JSON.parse(savedSub); } catch(e) { visibleSubjectsLocal = null; }
  }
}

function saveFilterState() {
  if (visibleClassIdsLocal === null) {
    localStorage.removeItem(CONFIG.storageKeys.visibleClasses);
  } else {
    localStorage.setItem(CONFIG.storageKeys.visibleClasses, JSON.stringify(visibleClassIdsLocal));
  }
  if (visibleSubjectsLocal === null) {
    localStorage.removeItem(CONFIG.storageKeys.visibleSubjects);
  } else {
    localStorage.setItem(CONFIG.storageKeys.visibleSubjects, JSON.stringify(visibleSubjectsLocal));
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
  var effectiveVisible = visibleClassIdsLocal || classesData.map(function(c) { return c.id; });
  container.innerHTML = classesData.map(function(cls) {
    var checked = effectiveVisible.indexOf(cls.id) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:6px 10px; border-radius:16px; border:1.5px solid ' + (checked ? 'var(--primary)' : 'var(--border)') + '; background:' + (checked ? 'var(--primary-light)' : '#fff') + '; cursor:pointer; font-size:13px; color:' + (checked ? 'var(--primary)' : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onClassFilterChange(' + cls.id + ', this.checked)" style="display:none;">' +
      cls.name +
      '</label>';
  }).join('');
  renderSubjectFilterCheckboxes();
}

function onClassFilterChange(classId, checked) {
  if (visibleClassIdsLocal === null) {
    visibleClassIdsLocal = classesData.map(function(c) { return c.id; });
  }
  if (checked) {
    if (visibleClassIdsLocal.indexOf(classId) === -1) visibleClassIdsLocal.push(classId);
  } else {
    visibleClassIdsLocal = visibleClassIdsLocal.filter(function(id) { return id !== classId; });
  }
  if (visibleClassIdsLocal.length === classesData.length) visibleClassIdsLocal = null;
  saveFilterState();
  renderFilterCheckboxes();
  renderClassTabs();
  updateFilterBtnHighlight();
}

function selectAllClasses() {
  visibleClassIdsLocal = null;
  saveFilterState();
  renderFilterCheckboxes();
  renderClassTabs();
  updateFilterBtnHighlight();
}

function clearAllClasses() {
  visibleClassIdsLocal = [];
  saveFilterState();
  renderFilterCheckboxes();
  renderClassTabs();
  updateFilterBtnHighlight();
}

function renderSubjectFilterCheckboxes() {
  var container = document.getElementById('filter-subject-checkboxes');
  if (!container) return;
  var allSubjectNames = CONFIG.subjects.map(function(s) { return s.name; });
  var effectiveVisible = visibleSubjectsLocal || allSubjectNames;
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
  if (visibleSubjectsLocal === null) {
    visibleSubjectsLocal = allSubjectNames.slice();
  }
  if (checked) {
    if (visibleSubjectsLocal.indexOf(subjectName) === -1) visibleSubjectsLocal.push(subjectName);
  } else {
    visibleSubjectsLocal = visibleSubjectsLocal.filter(function(n) { return n !== subjectName; });
  }
  if (visibleSubjectsLocal.length === allSubjectNames.length) visibleSubjectsLocal = null;
  saveFilterState();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  updateFilterBtnHighlight();
}

function selectAllSubjects() {
  visibleSubjectsLocal = null;
  saveFilterState();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  updateFilterBtnHighlight();
}

function clearAllSubjects() {
  visibleSubjectsLocal = [];
  saveFilterState();
  renderSubjectFilterCheckboxes();
  renderSubjectTabs();
  updateFilterBtnHighlight();
}

function updateFilterBtnHighlight() {
  var btn = document.getElementById('btn-filter');
  if (btn) btn.style.color = (visibleClassIdsLocal !== null || visibleSubjectsLocal !== null) ? 'var(--primary)' : '';
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
  if (btn && btn.contains(e.target)) return;
  if (menu.contains(e.target)) return;
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

async function init() {
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
      window.location.href = 'admin.html?from=class';
      return;
    }
    adminUser = user;
  } catch(e) {
    window.location.href = 'admin.html?from=class';
    return;
  }

  // 从 URL 参数读取初始状态
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  if (dateParam) currentDate = dateParam;
  const subjectParam = params.get('subject');
  if (subjectParam && CONFIG.subjects.find(function(s) { return s.name === subjectParam; })) {
    currentSubject = subjectParam;
  }

  // 加载班级列表
  try {
    classesData = await fetchClasses();
  } catch(e) {
    console.error('加载班级失败', e);
    classesData = [];
  }

  if (classesData.length === 0) {
    document.getElementById('student-grid').innerHTML = '<div class="empty-state"><p>暂无班级数据</p></div>';
    return;
  }

  // 确定当前班级
  const classParam = params.get('class');
  if (classParam) {
    const found = classesData.find(function(c) { return c.id === parseInt(classParam); });
    if (found) currentClassId = found.id;
  }
  if (!currentClassId) currentClassId = classesData[0].id;

  // 渲染日期选择器
  document.getElementById('date-picker').value = currentDate;
  document.getElementById('date-text').textContent = formatDateDisplay(currentDate);

  // 加载筛选状态
  loadFilterState();
  updateFilterBtnHighlight();

  // 渲染常驻筛选面板（班级+科目复选框）
  renderFilterCheckboxes();

  // 渲染标签
  renderClassTabs();
  renderSubjectTabs();

  // 加载作业列表（含学生表格）
  await loadHomeworkList();

  // 渲染管理员工具栏
  renderAdminToolbar();
}
document.addEventListener('DOMContentLoaded', init);