// ============================================================
// 管理员登录页逻辑 (admin.html)
// ============================================================

// ============================================================
// Toast 提示
// ============================================================
function showToast(msg, duration) {
  duration = duration || 2000;
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, duration);
}

// ============================================================
// 登录处理
// ============================================================
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btn-login');
  const errorEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = '登录中...';
  errorEl.textContent = '';

  try {
    const sb = initSupabase();
    if (!sb) {
      errorEl.textContent = '配置错误，请检查 config.js';
      btn.disabled = false;
      btn.textContent = '登录';
      return;
    }

    await signIn(email, password);
    // 登录成功后，检查 from 参数决定跳转，默认跳首页
    var fromPage = getFromParam() || 'index.html';
    window.location.href = fromPage;

  } catch(e) {
    let msg = '登录失败';
    if (e.message.includes('Invalid login credentials')) {
      msg = '邮箱或密码错误';
    } else if (e.message.includes('Email not confirmed')) {
      msg = '邮箱未验证，请查收验证邮件';
    } else {
      msg = e.message;
    }
    errorEl.textContent = msg;
    btn.disabled = false;
    btn.textContent = '登录';
  }
}

// ============================================================
// 退出登录
// ============================================================
async function handleLogout() {
  try {
    await getSupabase().auth.signOut();
  } catch(e) {}
  document.getElementById('manage-section').style.display = 'none';
  document.getElementById('login-section').style.display = '';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-error').textContent = '';
}

// ============================================================
// 显示管理面板
// ============================================================
function showManagePanel() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('manage-section').style.display = '';
  loadSubjectList();
  loadStatusList();
  loadClassList();
}

// ============================================================
// 科目管理
// ============================================================
async function loadSubjectList() {
  const container = document.getElementById('subject-list');
  container.innerHTML = '<div style="color:#999; font-size:13px;">加载中...</div>';
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('subjects').select('*').order('display_order');
    if (error) throw error;
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="color:#999; font-size:13px;">暂无科目</div>';
      updateBatchDeleteBtn('subjects');
      return;
    }
    container.innerHTML = data.map(function(s) {
      return '<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f0f0f0;" data-subject-id="' + s.id + '">' +
        '<input type="checkbox" class="subject-checkbox" onchange="updateBatchDeleteBtn(\'subjects\')" style="width:16px; height:16px; cursor:pointer; flex-shrink:0;">' +
        '<span style="font-size:18px; width:24px; text-align:center; flex-shrink:0;">' + (s.icon || '') + '</span>' +
        '<span class="subject-name" onclick="renameSubjectInline(' + s.id + ', this)" style="flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;" title="点击重命名">' + s.name + '</span>' +
        '<button onclick="deleteSubject(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')" style="font-size:11px; color:#f44336; background:none; border:1px solid #f44336; border-radius:12px; padding:2px 8px; cursor:pointer; flex-shrink:0;">删除</button>' +
        '</div>';
    }).join('');
    updateBatchDeleteBtn('subjects');
  } catch(e) {
    container.innerHTML = '<div style="color:#f44336; font-size:13px;">加载失败：' + e.message + '</div>';
  }
}

function updateBatchDeleteBtn(type) {
  if (type === 'subjects') {
    var checked = document.querySelectorAll('.subject-checkbox:checked');
    var btn = document.getElementById('btn-batch-delete-subjects');
    if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
  } else if (type === 'classes') {
    var checked = document.querySelectorAll('.class-checkbox:checked');
    var btn = document.getElementById('btn-batch-delete-classes');
    if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
  } else if (type === 'statuses') {
    var checked = document.querySelectorAll('.status-checkbox:checked');
    var btn = document.getElementById('btn-batch-delete-statuses');
    if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
  }
}

function renameSubjectInline(id, el) {
  if (el.tagName === 'INPUT') return; // 已在编辑中
  var oldName = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = 'flex:1; font-size:14px; border:1px solid var(--primary); border-radius:4px; padding:2px 6px; outline:none;';
  el.parentNode.replaceChild(input, el);
  input.focus();
  input.select();

  async function save() {
    var newName = input.value.trim();
    if (!newName || newName === oldName) {
      // 恢复原来的 span
      var span = document.createElement('span');
      span.className = 'subject-name';
      span.onclick = function() { renameSubjectInline(id, span); };
      span.style.cssText = 'flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;';
      span.title = '点击重命名';
      span.textContent = oldName;
      input.parentNode.replaceChild(span, input);
      return;
    }
    try {
      await updateSubjectName(id, newName);
      showToast('已重命名为：' + newName);
      await loadSubjectList();
    } catch(e) {
      showToast('重命名失败：' + e.message);
      await loadSubjectList();
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

async function batchDeleteSubjects() {
  var checked = document.querySelectorAll('.subject-checkbox:checked');
  if (checked.length === 0) return;
  var ids = Array.from(checked).map(function(cb) {
    return parseInt(cb.closest('[data-subject-id]').getAttribute('data-subject-id'));
  });
  if (!confirm('确定批量删除选中的 ' + ids.length + ' 个科目？此操作不可恢复。')) return;
  try {
    await deleteManySubjects(ids);
    showToast('已删除 ' + ids.length + ' 个科目');
    await loadSubjectList();
  } catch(e) {
    showToast('批量删除失败：' + e.message);
  }
}

async function addSubject() {
  const nameInput = document.getElementById('new-subject-name');
  const iconInput = document.getElementById('new-subject-icon');
  const name = nameInput.value.trim();
  const icon = iconInput.value.trim();
  if (!name) { showToast('请输入科目名称'); return; }
  try {
    await insertSubject(name, icon, '#666666');
    nameInput.value = '';
    iconInput.value = '';
    showToast('已新增科目：' + name);
    await loadSubjectList();
  } catch(e) {
    showToast('新增失败：' + e.message);
  }
}

async function deleteSubject(id, name) {
  if (!confirm('确定删除科目「' + name + '」？此操作不可恢复。')) return;
  try {
    await deleteSubjectById(id);
    showToast('已删除科目：' + name);
    await loadSubjectList();
  } catch(e) {
    showToast('删除失败：' + e.message);
  }
}

// ============================================================
// 班级管理
// ============================================================
async function loadClassList() {
  const container = document.getElementById('class-list');
  container.innerHTML = '<div style="color:#999; font-size:13px;">加载中...</div>';
  try {
    const data = await fetchClasses();
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="color:#999; font-size:13px;">暂无班级</div>';
      updateBatchDeleteBtn('classes');
      return;
    }
    container.innerHTML = data.map(function(c) {
      return '<div class="class-row-wrap" data-class-id="' + c.id + '">' +
        '<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f0f0f0;">' +
          '<input type="checkbox" class="class-checkbox" onchange="updateBatchDeleteBtn(\'classes\')" style="width:16px; height:16px; cursor:pointer; flex-shrink:0;">' +
          '<span class="class-name" onclick="renameClassInline(' + c.id + ', this)" style="flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;" title="点击重命名">' + c.name + '</span>' +
          '<span id="class-count-' + c.id + '" style="font-size:12px; color:#999; flex-shrink:0;">…人</span>' +
          '<button onclick="toggleStudentList(' + c.id + ', this)" style="font-size:11px; color:var(--primary); background:none; border:1px solid var(--primary); border-radius:12px; padding:2px 8px; cursor:pointer; flex-shrink:0;">学生</button>' +
          '<button onclick="deleteClass(' + c.id + ', \'' + c.name.replace(/'/g, "\\'") + '\')" style="font-size:11px; color:#f44336; background:none; border:1px solid #f44336; border-radius:12px; padding:2px 8px; cursor:pointer; flex-shrink:0;">删除</button>' +
        '</div>' +
        '<div class="student-list-area" style="display:none; background:#f9f9f9; border-radius:8px; padding:8px; margin-bottom:6px;"></div>' +
      '</div>';
    }).join('');
    updateBatchDeleteBtn('classes');
    // 异步加载每个班级的真实学生数
    data.forEach(async function(c) {
      try {
        const sb = getSupabase();
        const { count } = await sb.from('students').select('id', { count: 'exact', head: true }).eq('class_id', c.id);
        var el = document.getElementById('class-count-' + c.id);
        if (el) el.textContent = (count || 0) + '人';
      } catch(e) {
        var el = document.getElementById('class-count-' + c.id);
        if (el) el.textContent = '?人';
      }
    });
  } catch(e) {
    container.innerHTML = '<div style="color:#f44336; font-size:13px;">加载失败：' + e.message + '</div>';
  }
}

function renameClassInline(id, el) {
  if (el.tagName === 'INPUT') return;
  var oldName = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = 'flex:1; font-size:14px; border:1px solid var(--primary); border-radius:4px; padding:2px 6px; outline:none;';
  el.parentNode.replaceChild(input, el);
  input.focus();
  input.select();

  async function save() {
    var newName = input.value.trim();
    if (!newName || newName === oldName) {
      var span = document.createElement('span');
      span.className = 'class-name';
      span.onclick = function() { renameClassInline(id, span); };
      span.style.cssText = 'flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;';
      span.title = '点击重命名';
      span.textContent = oldName;
      input.parentNode.replaceChild(span, input);
      return;
    }
    try {
      await updateClassName(id, newName);
      showToast('已重命名为：' + newName);
      await loadClassList();
    } catch(e) {
      showToast('重命名失败：' + e.message);
      await loadClassList();
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

async function toggleStudentList(classId, btn) {
  var wrap = btn.closest('.class-row-wrap');
  var area = wrap.querySelector('.student-list-area');
  if (area.style.display !== 'none') {
    area.style.display = 'none';
    btn.textContent = '学生';
    return;
  }
  area.style.display = 'block';
  btn.textContent = '收起';
  await loadStudentList(classId, area);
}

async function loadStudentList(classId, container) {
  container.innerHTML = '<div style="color:#999; font-size:12px; padding:4px 0;">加载中...</div>';
  try {
    const students = await fetchStudents(classId);
    var html = '';
    if (!students || students.length === 0) {
      html = '<div style="color:#999; font-size:12px; padding:4px 0;">暂无学生</div>';
    } else {
      // 批量删除工具栏
      html = '<div id="student-batch-bar-' + classId + '" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding:4px 0; border-bottom:1px solid #eee;">' +
        '<label style="display:flex; align-items:center; gap:4px; font-size:12px; color:#666; cursor:pointer;">' +
          '<input type="checkbox" id="student-select-all-' + classId + '" onchange="toggleSelectAllStudents(' + classId + ', this)" style="width:14px; height:14px; cursor:pointer;"> 全选' +
        '</label>' +
        '<button id="btn-batch-delete-students-' + classId + '" onclick="batchDeleteStudents(' + classId + ')" style="display:none; height:26px; padding:0 10px; font-size:12px; background:#f44336; color:#fff; border:none; border-radius:6px; cursor:pointer;">批量删除</button>' +
      '</div>';
      html += students.map(function(s) {
        var displayName = s.name ? s.name : ('学生' + s.student_number);
        return '<div style="display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid #eee;" data-student-id="' + s.id + '">' +
          '<input type="checkbox" class="student-checkbox-' + classId + '" data-student-id="' + s.id + '" data-student-name="' + displayName.replace(/"/g, '&quot;') + '" onchange="updateStudentBatchBtn(' + classId + ')" style="width:14px; height:14px; cursor:pointer; flex-shrink:0;">' +
          '<span style="font-size:12px; color:#999; width:28px; flex-shrink:0;">' + s.student_number + '</span>' +
          '<span class="student-name" onclick="renameStudentInline(' + s.id + ', this)" style="flex:1; font-size:13px; cursor:pointer; padding:1px 4px; border-radius:4px;" title="点击改名">' + (s.name || '') + '</span>' +
          '<button onclick="deleteStudent(' + s.id + ', \'' + displayName.replace(/'/g, "\\'") + '\', ' + classId + ', this)" style="font-size:11px; color:#f44336; background:none; border:1px solid #f44336; border-radius:10px; padding:1px 6px; cursor:pointer; flex-shrink:0;">删除</button>' +
          '</div>';
      }).join('');
    }
    // 新增学生表单
    var maxNum = students && students.length > 0 ? Math.max.apply(null, students.map(function(s) { return s.student_number; })) : 0;
    html += '<div style="display:flex; gap:6px; margin-top:8px; align-items:center;">' +
      '<input type="number" id="new-student-num-' + classId + '" placeholder="学号" value="' + (maxNum + 1) + '" style="width:60px; height:30px; font-size:12px; border:1px solid var(--border); border-radius:6px; padding:0 6px; text-align:center;">' +
      '<input type="text" id="new-student-name-' + classId + '" placeholder="姓名（可选）" style="flex:1; height:30px; font-size:12px; border:1px solid var(--border); border-radius:6px; padding:0 8px;">' +
      '<button onclick="addStudent(' + classId + ', this)" style="height:30px; padding:0 10px; font-size:12px; background:var(--primary); color:#fff; border:none; border-radius:6px; cursor:pointer; flex-shrink:0;">新增</button>' +
      '</div>' +
      '<div style="margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
        '<label style="height:30px; padding:0 10px; font-size:12px; background:#fff; color:var(--primary); border:1px solid var(--primary); border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; flex-shrink:0;">' +
          '📥 导入 Excel' +
          '<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="importStudentsFromExcel(' + classId + ', this)">' +
        '</label>' +
        '<span style="font-size:11px; color:#999; line-height:1.4;">格式：A列=学号，B列=姓名（第1行为表头，从第2行开始）</span>' +
      '</div>';
    container.innerHTML = html;
    // 同步刷新班级人数标签
    var countEl = document.getElementById('class-count-' + classId);
    if (countEl) countEl.textContent = (students ? students.length : 0) + '人';
  } catch(e) {
    container.innerHTML = '<div style="color:#f44336; font-size:12px;">加载失败：' + e.message + '</div>';
  }
}

function renameStudentInline(studentId, el) {
  if (el.tagName === 'INPUT') return;
  var oldName = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.placeholder = '输入姓名';
  input.style.cssText = 'flex:1; font-size:13px; border:1px solid var(--primary); border-radius:4px; padding:1px 6px; outline:none;';
  el.parentNode.replaceChild(input, el);
  input.focus();
  input.select();

  async function save() {
    var newName = input.value.trim();
    var span = document.createElement('span');
    span.className = 'student-name';
    span.onclick = function() { renameStudentInline(studentId, span); };
    span.style.cssText = 'flex:1; font-size:13px; cursor:pointer; padding:1px 4px; border-radius:4px;';
    span.title = '点击改名';
    span.textContent = newName;
    input.parentNode.replaceChild(span, input);
    if (newName === oldName) return;
    try {
      await updateStudentName(studentId, newName);
      showToast('已保存');
    } catch(e) {
      showToast('保存失败：' + e.message);
      span.textContent = oldName;
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

async function deleteStudent(studentId, name, classId, btn) {
  if (!confirm('确定删除学生「' + name + '」？将同时删除其所有作业记录，此操作不可恢复。')) return;
  try {
    await deleteStudentById(studentId);
    showToast('已删除学生：' + name);
    // 重新加载学生列表
    var wrap = btn.closest('.class-row-wrap');
    var area = wrap.querySelector('.student-list-area');
    await loadStudentList(classId, area);
  } catch(e) {
    showToast('删除失败：' + e.message);
  }
}

async function addStudent(classId, btn) {
  var numInput = document.getElementById('new-student-num-' + classId);
  var nameInput = document.getElementById('new-student-name-' + classId);
  var num = parseInt(numInput.value);
  var name = nameInput.value.trim();
  if (!num || num < 1) { showToast('请输入有效学号'); return; }
  try {
    await insertStudent(classId, num, name || null);
    showToast('已新增学生：' + (name || '学生' + num));
    var wrap = btn.closest('.class-row-wrap');
    var area = wrap.querySelector('.student-list-area');
    await loadStudentList(classId, area);
  } catch(e) {
    showToast('新增失败：' + e.message);
  }
}

async function batchDeleteClasses() {
  var checked = document.querySelectorAll('.class-checkbox:checked');
  if (checked.length === 0) return;
  var ids = Array.from(checked).map(function(cb) {
    return parseInt(cb.closest('[data-class-id]').getAttribute('data-class-id'));
  });
  if (!confirm('确定批量删除选中的 ' + ids.length + ' 个班级？将同时删除这些班级的所有学生和作业记录，此操作不可恢复。')) return;
  try {
    await deleteManyClasses(ids);
    showToast('已删除 ' + ids.length + ' 个班级');
    await loadClassList();
  } catch(e) {
    showToast('批量删除失败：' + e.message);
  }
}

async function addClass() {
  const nameInput = document.getElementById('new-class-name');
  const countInput = document.getElementById('new-class-count');
  const name = nameInput.value.trim();
  const count = parseInt(countInput.value) || 0;
  if (!name) { showToast('请输入班级名称'); return; }
  try {
    await insertClass(name, count);
    nameInput.value = '';
    countInput.value = '';
    showToast('已新增班级：' + name);
    await loadClassList();
  } catch(e) {
    showToast('新增失败：' + e.message);
  }
}

async function deleteClass(id, name) {
  if (!confirm('确定删除班级「' + name + '」？将同时删除该班所有学生和作业记录，此操作不可恢复。')) return;
  try {
    await deleteClassById(id);
    showToast('已删除班级：' + name);
    await loadClassList();
  } catch(e) {
    showToast('删除失败：' + e.message);
  }
}

// ============================================================
// 工具函数：获取 from 参数对应的跳转页面
// ============================================================
function getFromParam() {
  var params = new URLSearchParams(window.location.search);
  var from = params.get('from');
  if (!from) return null;
  // 根据 from 值构建跳转 URL
  if (from === 'index') return 'index.html';
  if (from === 'stats') return 'stats.html';
  if (from === 'class') {
    var classId = params.get('class');
    var date = params.get('date');
    var url = 'class.html';
    var qs = [];
    if (classId) qs.push('class=' + classId);
    if (date) qs.push('date=' + date);
    if (qs.length > 0) url += '?' + qs.join('&');
    return url;
  }
  return null;
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  const sb = initSupabase();
  if (!sb) return;

  // 如果已经登录，检查 from 参数决定跳转还是显示管理面板
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      var fromPage = getFromParam();
      if (fromPage) {
        // 已登录且有 from 参数（从其他页面跳来的），跳回来源页
        window.location.href = fromPage;
        return;
      }
      // 已登录且无 from 参数（直接访问管理页），显示管理面板
      showManagePanel();
      return;
    }
  } catch(e) {
    console.error('检查登录状态失败:', e);
  }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// 学生批量删除
// ============================================================
function toggleSelectAllStudents(classId, selectAllCb) {
  var checkboxes = document.querySelectorAll('.student-checkbox-' + classId);
  checkboxes.forEach(function(cb) { cb.checked = selectAllCb.checked; });
  updateStudentBatchBtn(classId);
}

function updateStudentBatchBtn(classId) {
  var checked = document.querySelectorAll('.student-checkbox-' + classId + ':checked');
  var btn = document.getElementById('btn-batch-delete-students-' + classId);
  if (btn) btn.style.display = checked.length > 0 ? 'inline-block' : 'none';
  // 同步全选框状态
  var all = document.querySelectorAll('.student-checkbox-' + classId);
  var selectAllCb = document.getElementById('student-select-all-' + classId);
  if (selectAllCb) {
    selectAllCb.checked = all.length > 0 && checked.length === all.length;
    selectAllCb.indeterminate = checked.length > 0 && checked.length < all.length;
  }
}

async function batchDeleteStudents(classId) {
  var checked = document.querySelectorAll('.student-checkbox-' + classId + ':checked');
  if (checked.length === 0) return;
  var names = Array.from(checked).map(function(cb) { return cb.getAttribute('data-student-name'); }).join('、');
  if (!confirm('确定删除选中的 ' + checked.length + ' 名学生（' + names + '）？将同时删除其所有作业记录，此操作不可恢复。')) return;
  var ids = Array.from(checked).map(function(cb) { return parseInt(cb.getAttribute('data-student-id')); });
  var btn = document.getElementById('btn-batch-delete-students-' + classId);
  if (btn) { btn.disabled = true; btn.textContent = '删除中...'; }
  var successCount = 0;
  var errorCount = 0;
  for (var i = 0; i < ids.length; i++) {
    try {
      await deleteStudentById(ids[i]);
      successCount++;
    } catch(e) {
      errorCount++;
      console.error('删除学生失败:', e);
    }
  }
  var msg = '已删除 ' + successCount + ' 名学生';
  if (errorCount > 0) msg += '，失败 ' + errorCount + ' 名';
  showToast(msg);
  // 找到对应的 student-list-area 容器并刷新
  var area = btn ? btn.closest('.student-list-area') : null;
  if (area) await loadStudentList(classId, area);
}

// ============================================================
// Excel 导入学生
// ============================================================
async function importStudentsFromExcel(classId, fileInput) {
  var file = fileInput.files[0];
  if (!file) return;

  // 检查 SheetJS 是否已加载
  if (typeof XLSX === 'undefined') {
    showToast('Excel 解析库未加载，请检查网络后刷新重试');
    fileInput.value = '';
    return;
  }

  // 找到对应的学生列表容器（fileInput 在 label 里，label 在 div 里，div 在 container 里）
  var container = fileInput.closest('.student-list-area') || fileInput.parentElement.parentElement.parentElement;

  showToast('正在解析 Excel...');

  try {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // 跳过第1行表头，从第2行开始
        var dataRows = rows.slice(1).filter(function(row) {
          return row[0] !== '' && row[0] !== null && row[0] !== undefined;
        });

        if (dataRows.length === 0) {
          showToast('未找到有效数据，请检查格式（A列=学号，B列=姓名，第2行起）');
          fileInput.value = '';
          return;
        }

        var successCount = 0;
        var skipCount = 0;
        var errorCount = 0;

        for (var i = 0; i < dataRows.length; i++) {
          var row = dataRows[i];
          var studentNumber = parseInt(row[0]);
          var studentName = (row[1] !== undefined && row[1] !== null) ? String(row[1]).trim() : '';

          if (isNaN(studentNumber) || studentNumber <= 0) {
            errorCount++;
            continue;
          }

          try {
            await insertStudent(classId, studentNumber, studentName || null);
            successCount++;
          } catch(err) {
            // 重复学号（唯一键冲突）跳过
            if (err.message && (err.message.indexOf('duplicate') !== -1 || err.message.indexOf('unique') !== -1 || err.code === '23505')) {
              skipCount++;
            } else {
              errorCount++;
              console.error('导入第' + (i + 2) + '行失败:', err);
            }
          }
        }

        var msg = '导入完成：成功 ' + successCount + ' 人';
        if (skipCount > 0) msg += '，跳过重复 ' + skipCount + ' 人';
        if (errorCount > 0) msg += '，失败 ' + errorCount + ' 人';
        showToast(msg);

        // 刷新学生列表
        await loadStudentList(classId, container);
      } catch(parseErr) {
        showToast('解析失败：' + parseErr.message);
      }
      fileInput.value = '';
    };
    reader.readAsArrayBuffer(file);
  } catch(e) {
    showToast('导入失败：' + e.message);
    fileInput.value = '';
  }
}

// ============================================================
// 作业状态管理
// ============================================================

// 预定义的图标和颜色池（用于新增状态时自动分配）
const STATUS_ICONS = ['✓', '★', '▲', '●', '■', '◆', '✦', '✿', '❖', '◉'];
const STATUS_COLORS = [
  { bg: '#4caf50', text: '#ffffff' },
  { bg: '#2196f3', text: '#ffffff' },
  { bg: '#ff9800', text: '#ffffff' },
  { bg: '#9c27b0', text: '#ffffff' },
  { bg: '#00bcd4', text: '#ffffff' },
  { bg: '#e91e63', text: '#ffffff' },
  { bg: '#795548', text: '#ffffff' },
  { bg: '#607d8b', text: '#ffffff' },
  { bg: '#f44336', text: '#ffffff' },
  { bg: '#3f51b5', text: '#ffffff' },
];

async function loadStatusList() {
  const container = document.getElementById('status-list');
  container.innerHTML = '<div style="color:#999; font-size:13px;">加载中...</div>';
  try {
    const data = await fetchStatuses();
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="color:#999; font-size:13px;">暂无自定义状态</div>';
      updateBatchDeleteBtn('statuses');
      return;
    }
    container.innerHTML = data.map(function(s) {
      return '<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f0f0f0;" data-status-id="' + s.id + '">' +
        '<input type="checkbox" class="status-checkbox" onchange="updateBatchDeleteBtn(\'statuses\')" style="width:16px; height:16px; cursor:pointer; flex-shrink:0;">' +
        '<span class="status-icon" onclick="editStatusIconInline(' + s.id + ', this, \'' + (s.icon || '').replace(/'/g, "\\'") + '\')" style="font-size:18px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:' + (s.bg_color || '#f0f0f0') + '; color:' + (s.color || '#333') + '; border-radius:50%; cursor:pointer; flex-shrink:0;" title="点击修改图标">' + (s.icon || '—') + '</span>' +
        '<span class="status-name" onclick="renameStatusInline(' + s.id + ', this)" style="flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;" title="点击重命名">' + s.name + '</span>' +
        '<span onclick="editStatusColorsInline(' + s.id + ', \'' + (s.bg_color || '#f0f0f0').replace(/'/g, "\\'") + '\', \'' + (s.color || '#333').replace(/'/g, "\\'") + '\')" style="font-size:11px; color:var(--primary); cursor:pointer; padding:2px 8px; border:1px solid var(--primary); border-radius:12px; flex-shrink:0;" title="点击修改颜色">颜色</span>' +
        '<button onclick="deleteStatus(' + s.id + ', \'' + s.name.replace(/'/g, "\\'") + '\')" style="font-size:11px; color:#f44336; background:none; border:1px solid #f44336; border-radius:12px; padding:2px 8px; cursor:pointer; flex-shrink:0;">删除</button>' +
        '</div>';
    }).join('');
    updateBatchDeleteBtn('statuses');
  } catch(e) {
    container.innerHTML = '<div style="color:#f44336; font-size:13px;">加载失败：' + e.message + '</div>';
  }
}

async function addStatus() {
  const nameInput = document.getElementById('new-status-name');
  const name = nameInput.value.trim();
  if (!name) { showToast('请输入状态名称'); return; }
  
  // 自动分配图标和颜色
  try {
    const existingStatuses = await fetchStatuses();
    const index = existingStatuses ? existingStatuses.length : 0;
    const icon = STATUS_ICONS[index % STATUS_ICONS.length];
    const colorSet = STATUS_COLORS[index % STATUS_COLORS.length];
    
    await insertStatus(name, icon, colorSet.text, colorSet.text, colorSet.bg);
    nameInput.value = '';
    showToast('已新增状态：' + name + '（图标：' + icon + '）');
    await loadStatusList();
    // 同步更新 config.js 中的状态配置
    await reloadConfigStatuses();
  } catch(e) {
    showToast('新增失败：' + e.message);
  }
}

async function deleteStatus(id, name) {
  if (!confirm('确定删除状态「' + name + '」？此操作不可恢复。')) return;
  try {
    await deleteStatusById(id);
    showToast('已删除状态：' + name);
    await loadStatusList();
    await reloadConfigStatuses();
  } catch(e) {
    showToast('删除失败：' + e.message);
  }
}

async function batchDeleteStatuses() {
  var checked = document.querySelectorAll('.status-checkbox:checked');
  if (checked.length === 0) return;
  var ids = Array.from(checked).map(function(cb) {
    return parseInt(cb.closest('[data-status-id]').getAttribute('data-status-id'));
  });
  if (!confirm('确定批量删除选中的 ' + ids.length + ' 个状态？此操作不可恢复。')) return;
  try {
    await deleteManyStatuses(ids);
    showToast('已删除 ' + ids.length + ' 个状态');
    await loadStatusList();
    await reloadConfigStatuses();
  } catch(e) {
    showToast('批量删除失败：' + e.message);
  }
}

// 重命名状态（内联编辑）
function renameStatusInline(id, el) {
  if (el.tagName === 'INPUT') return;
  var oldName = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = 'flex:1; font-size:14px; border:1px solid var(--primary); border-radius:4px; padding:2px 6px; outline:none;';
  el.parentNode.replaceChild(input, el);
  input.focus();
  input.select();

  async function save() {
    var newName = input.value.trim();
    if (!newName || newName === oldName) {
      var span = document.createElement('span');
      span.className = 'status-name';
      span.onclick = function() { renameStatusInline(id, span); };
      span.style.cssText = 'flex:1; font-size:14px; cursor:pointer; padding:2px 4px; border-radius:4px;';
      span.title = '点击重命名';
      span.textContent = oldName;
      input.parentNode.replaceChild(span, input);
      return;
    }
    try {
      await updateStatusName(id, newName);
      showToast('已重命名为：' + newName);
      await loadStatusList();
      await reloadConfigStatuses();
    } catch(e) {
      showToast('重命名失败：' + e.message);
      await loadStatusList();
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

// 编辑图标（内联编辑）
function editStatusIconInline(id, el, oldIcon) {
  if (el.tagName === 'INPUT') return;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldIcon;
  input.style.cssText = 'width:32px; height:32px; font-size:18px; text-align:center; border:2px solid var(--primary); border-radius:50%; outline:none; background:#fff; cursor:pointer; flex-shrink:0;';
  el.parentNode.replaceChild(input, el);
  input.focus();
  input.select();

  async function save() {
    var newIcon = input.value.trim();
    try {
      await updateStatusIcon(id, newIcon);
      showToast('图标已更新');
      await loadStatusList();
      await reloadConfigStatuses();
    } catch(e) {
      showToast('更新失败：' + e.message);
      await loadStatusList();
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldIcon; input.blur(); }
  });
}

// 编辑颜色（弹出选择）
function editStatusColorsInline(id, oldBgColor, oldTextColor) {
  // 创建简单的颜色选择弹窗
  var modal = document.createElement('div');
  modal.id = 'color-picker-modal';
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px;';
  
  var panel = document.createElement('div');
  panel.style.cssText = 'background:#fff; border-radius:16px; padding:20px; width:100%; max-width:320px;';
  
  panel.innerHTML = 
    '<div style="font-size:16px; font-weight:600; margin-bottom:16px;">选择颜色方案</div>' +
    '<div style="margin-bottom:16px;">' +
      '<div style="font-size:13px; color:#666; margin-bottom:8px;">背景色</div>' +
      '<div id="bg-color-options" style="display:flex; flex-wrap:wrap; gap:8px;"></div>' +
    '</div>' +
    '<div style="margin-bottom:20px;">' +
      '<div style="font-size:13px; color:#666; margin-bottom:8px;">文字颜色</div>' +
      '<div id="text-color-options" style="display:flex; flex-wrap:wrap; gap:8px;"></div>' +
    '</div>' +
    '<div style="display:flex; gap:10px;">' +
      '<button id="btn-cancel-color" style="flex:1; height:40px; font-size:14px; background:#f0f0f0; color:#666; border:none; border-radius:8px; cursor:pointer;">取消</button>' +
      '<button id="btn-save-color" style="flex:1; height:40px; font-size:14px; background:var(--primary); color:#fff; border:none; border-radius:8px; cursor:pointer;">保存</button>' +
    '</div>';
  
  modal.appendChild(panel);
  document.body.appendChild(modal);
  
  var selectedBg = oldBgColor;
  var selectedText = oldTextColor;
  
  // 生成背景色选项
  var bgContainer = document.getElementById('bg-color-options');
  STATUS_COLORS.forEach(function(c) {
    var btn = document.createElement('button');
    btn.style.cssText = 'width:40px; height:40px; border-radius:50%; border:3px solid ' + (c.bg === selectedBg ? 'var(--primary)' : 'transparent') + '; background:' + c.bg + '; cursor:pointer;';
    btn.onclick = function() {
      selectedBg = c.bg;
      selectedText = c.text;
      // 更新选中样式
      Array.from(bgContainer.children).forEach(function(child) {
        child.style.borderColor = 'transparent';
      });
      btn.style.borderColor = 'var(--primary)';
      // 自动同步文字颜色
      Array.from(textContainer.children).forEach(function(child) {
        child.style.borderColor = child.style.backgroundColor === selectedText ? 'var(--primary)' : 'transparent';
      });
    };
    bgContainer.appendChild(btn);
  });
  
  // 生成文字色选项
  var textContainer = document.getElementById('text-color-options');
  ['#ffffff', '#333333', '#000000'].forEach(function(c) {
    var btn = document.createElement('button');
    btn.style.cssText = 'width:40px; height:40px; border-radius:50%; border:3px solid ' + (c === selectedText ? 'var(--primary)' : '#ddd') + '; background:' + c + '; cursor:pointer;';
    if (c === '#ffffff') btn.style.boxShadow = 'inset 0 0 0 1px #ddd';
    btn.onclick = function() {
      selectedText = c;
      Array.from(textContainer.children).forEach(function(child) {
        child.style.borderColor = '#ddd';
      });
      btn.style.borderColor = 'var(--primary)';
    };
    textContainer.appendChild(btn);
  });
  
  // 事件绑定
  document.getElementById('btn-cancel-color').onclick = function() {
    document.body.removeChild(modal);
  };
  
  document.getElementById('btn-save-color').onclick = async function() {
    try {
      await updateStatus(id, { bg_color: selectedBg, color: selectedText, text_color: selectedText });
      showToast('颜色已更新');
      document.body.removeChild(modal);
      await loadStatusList();
      await reloadConfigStatuses();
    } catch(e) {
      showToast('更新失败：' + e.message);
    }
  };
  
  // 点击背景关闭
  modal.onclick = function(e) {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

// 重新加载配置中的状态（用于其他页面同步）
async function reloadConfigStatuses() {
  try {
    var statuses = await fetchStatuses();
    if (statuses && statuses.length > 0) {
      CONFIG.statuses = statuses.map(function(s) {
        return {
          name: s.name,
          icon: s.icon || '',
          color: s.color || '#333333',
          textColor: s.text_color || '#333333',
          bgColor: s.bg_color || '#f0f0f0'
        };
      });
    }
  } catch(e) {
    console.error('重新加载状态配置失败:', e);
  }
}
