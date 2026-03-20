// ============================================================
// 统计页逻辑 (stats.html) - 三 Tab 版本
// ============================================================

let adminUser = null;
let classesData = [];
let currentStatsTab = 'summary';
let currentDetailFilter = ''; // 班级明细状态筛选：''=全部, '未交', '已交', '优秀'

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}
function getNDaysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function showToast(msg, duration) {
  duration = duration || 2000;
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, duration);
}

// ============================================================
// Tab 切换
// ============================================================
function switchStatsTab(tab) {
  currentStatsTab = tab;
  ['summary', 'class-detail', 'personal'].forEach(function(t) {
    const el = document.getElementById('tab-' + t);
    const btn = document.getElementById('tab-btn-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.style.background = t === tab ? 'var(--primary)' : 'var(--bg)';
      btn.style.color = t === tab ? '#fff' : 'var(--text-secondary)';
    }
  });
}

// ============================================================
// Tab 1: 班级汇总
// ============================================================
var selectedSummaryClasses = []; // 班级汇总选中的班级（空数组=全部）
var selectedSummarySubjects = []; // 班级汇总选中的科目（空数组=全部）

function renderSummaryClassCheckboxes() {
  var container = document.getElementById('summary-class-checkboxes');
  if (!container) return;
  container.innerHTML = classesData.map(function(cls) {
    var checked = selectedSummaryClasses.length === 0 || selectedSummaryClasses.indexOf(cls.id) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:16px; border:1.5px solid ' + (checked ? 'var(--primary)' : 'var(--border)') + '; background:' + (checked ? 'var(--primary-light)' : '#fff') + '; cursor:pointer; font-size:12px; color:' + (checked ? 'var(--primary)' : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onSummaryClassChange(' + cls.id + ', this.checked)" style="display:none;">' +
      cls.name +
      '</label>';
  }).join('');
}

function onSummaryClassChange(classId, checked) {
  if (selectedSummaryClasses.length === 0) {
    selectedSummaryClasses = classesData.map(function(c) { return c.id; });
  }
  if (checked) {
    if (selectedSummaryClasses.indexOf(classId) === -1) selectedSummaryClasses.push(classId);
  } else {
    selectedSummaryClasses = selectedSummaryClasses.filter(function(id) { return id !== classId; });
  }
  if (selectedSummaryClasses.length === classesData.length) selectedSummaryClasses = [];
  renderSummaryClassCheckboxes();
}

function getSelectedSummaryClasses() {
  return selectedSummaryClasses;
}

function renderSummarySubjectCheckboxes() {
  var container = document.getElementById('summary-subject-checkboxes');
  if (!container) return;
  container.innerHTML = CONFIG.subjects.map(function(s) {
    var checked = selectedSummarySubjects.length === 0 || selectedSummarySubjects.indexOf(s.name) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:16px; border:1.5px solid ' + (checked ? s.color : 'var(--border)') + '; background:' + (checked ? s.color + '18' : '#fff') + '; cursor:pointer; font-size:12px; color:' + (checked ? s.color : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onSummarySubjectChange(\'' + s.name + '\', this.checked)" style="display:none;">' +
      s.icon + ' ' + s.name +
      '</label>';
  }).join('');
}

function onSummarySubjectChange(subjectName, checked) {
  if (selectedSummarySubjects.length === 0) {
    selectedSummarySubjects = CONFIG.subjects.map(function(s) { return s.name; });
  }
  if (checked) {
    if (selectedSummarySubjects.indexOf(subjectName) === -1) selectedSummarySubjects.push(subjectName);
  } else {
    selectedSummarySubjects = selectedSummarySubjects.filter(function(n) { return n !== subjectName; });
  }
  if (selectedSummarySubjects.length === CONFIG.subjects.length) selectedSummarySubjects = [];
  renderSummarySubjectCheckboxes();
}

function getSelectedSummarySubjects() {
  return selectedSummarySubjects;
}

async function loadSummaryStats() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  // 从多选复选框获取选中的科目
  var selectedSubjects = getSelectedSummarySubjects();

  if (!startDate || !endDate) { showToast('请选择开始和结束日期'); return; }
  if (startDate > endDate) { showToast('开始日期不能晚于结束日期'); return; }

  document.getElementById('summary-loading').style.display = 'flex';
  document.getElementById('summary-cards').style.display = 'none';
  document.getElementById('bar-chart-card').style.display = 'none';
  document.getElementById('summary-table-card').style.display = 'none';
  document.getElementById('summary-empty').style.display = 'none';
  var statScope = document.getElementById('stat-scope');
  if (statScope) statScope.style.display = 'none';

  try {
    const records = await fetchRecordsByDateRange(startDate, endDate);
    var filtered = records;
    // 按多选科目过滤
    if (selectedSubjects.length > 0) {
      filtered = records.filter(function(r) {
        if (!r.homework_name) return false;
        var subPrefix = r.homework_name.indexOf('-') >= 0 ? r.homework_name.split('-')[0] : '';
        return selectedSubjects.indexOf(subPrefix) !== -1;
      });
    } else if (visibleSubjectsLocal !== null) {
      filtered = records.filter(function(r) {
        if (!r.homework_name) return false;
        var subPrefix = r.homework_name.indexOf('-') >= 0 ? r.homework_name.split('-')[0] : '';
        return visibleSubjectsLocal.indexOf(subPrefix) !== -1;
      });
    }

    if (filtered.length === 0) {
      document.getElementById('summary-empty').style.display = 'flex';
      return;
    }

    // 从 Tab1 班级多选复选框获取选中的班级
    var selectedClasses = getSelectedSummaryClasses();
    var filteredClasses = selectedClasses.length > 0
      ? classesData.filter(function(cls) { return selectedClasses.indexOf(cls.id) !== -1; })
      : classesData;

    // 统计各班数据
    var classStatsMap = {};
    filteredClasses.forEach(function(cls) {
      classStatsMap[cls.id] = {
        id: cls.id, name: cls.name, displayOrder: cls.display_order,
        studentCount: cls.student_count || 0,
        submitted: 0, excellent: 0, pending: 0, total: 0,
        homeworkNames: new Set() // 记录该班级有多少个不同的作业
      };
    });

    filtered.forEach(function(r) {
      const classId = r.students && r.students.class_id;
      if (!classId || !classStatsMap[classId]) return;
      const stat = classStatsMap[classId];
      stat.total++;
      stat.homeworkNames.add(r.homework_name);
      if (r.status === '已交') stat.submitted++;
      else if (r.status === '优秀') { stat.submitted++; stat.excellent++; }
      // 注意：未交人次不在这里累加，而是用 期望总数 - 已交 计算
    });

    // 计算日期天数（用于跨日期平均值）
    var d1 = new Date(startDate + 'T00:00:00');
    var d2 = new Date(endDate + 'T00:00:00');
    var dayCount = Math.round((d2 - d1) / 86400000) + 1;

    // 计算各班完成率（平均完成率 = 已交人次 / (班级人数 × 作业次数)）
    let totalSubmitted = 0, totalPending = 0;
    var classRates = [];
    // 总人次 = Σ(班级人数) × 选中科目数（每个科目可能有多个作业，用 homeworkNames 去重后的科目数）
    var totalStudentCount = 0;
    // 选中科目数（用于总人次计算）
    var selectedSubjectCount = selectedSubjects.length > 0 ? selectedSubjects.length : CONFIG.subjects.length;
    Object.values(classStatsMap).forEach(function(s) {
      var hwCount = s.homeworkNames.size || 1;
      var expectedTotal = s.studentCount * hwCount;
      // 未交 = 期望总提交数 - 实际已交数（包含没有记录的学生）
      var pendingCount = Math.max(0, expectedTotal - s.submitted);
      s.pending = pendingCount;
      totalSubmitted += s.submitted;
      totalPending += pendingCount;
      totalStudentCount += s.studentCount;
      var rate = expectedTotal > 0 ? s.submitted / expectedTotal * 100 : 0;
      s.rate = Math.round(rate);
      if (s.total > 0) classRates.push(rate);
    });
    // 总人次 = 各班人数之和 × 选中科目数（多科目时累加）
    // 注意：这里用 homeworkNames 的科目维度来计算，更准确
    // 实际总人次 = Σ(班级人数 × 该班作业数)
    var totalExpected = 0;
    Object.values(classStatsMap).forEach(function(s) {
      totalExpected += s.studentCount * (s.homeworkNames.size || 1);
    });
    totalStudentCount = totalExpected;

    // 总完成率 = 各班完成率的平均值
    var totalRate = classRates.length > 0 ? Math.round(classRates.reduce(function(a, b) { return a + b; }, 0) / classRates.length) : 0;

    // 跨日期时，已交/未交显示日均值；总人次显示所有班级学生总人数
    var displaySubmitted = dayCount > 1 ? Math.round(totalSubmitted / dayCount) : totalSubmitted;
    var displayPending = dayCount > 1 ? Math.round(totalPending / dayCount) : totalPending;
    var submittedLabel = dayCount > 1 ? (displaySubmitted + '（日均）') : displaySubmitted;
    var pendingLabel = dayCount > 1 ? (displayPending + '（日均）') : displayPending;

    document.getElementById('stat-rate').textContent = totalRate + '%';
    document.getElementById('stat-submitted').textContent = submittedLabel;
    document.getElementById('stat-pending').textContent = pendingLabel;
    document.getElementById('stat-total').textContent = totalStudentCount;
    document.getElementById('summary-cards').style.display = 'block';

    // 显示统计范围
    if (statScope) {
      var scopeText = '统计班级：' + filteredClasses.map(function(c) { return c.name; }).join('、');
      if (selectedSubjects.length > 0) {
        scopeText += ' | 统计科目：' + selectedSubjects.join('、');
      }
      statScope.textContent = scopeText;
      statScope.style.display = 'block';
    }

    // 条形图（使用各班自己的完成率）
    const sortedClasses = Object.values(classStatsMap)
      .sort(function(a, b) { return a.displayOrder - b.displayOrder; });

    const barChart = document.getElementById('bar-chart');
    barChart.innerHTML = sortedClasses.map(function(s) {
      var rate = s.rate;
      const color = rate >= 90 ? '#4caf50' : rate >= 70 ? '#ff9800' : '#f44336';
      return '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">' +
        '<span style="width:36px; font-size:12px; color:var(--text-secondary); text-align:right; flex-shrink:0;">' + s.name + '</span>' +
        '<div style="flex:1; background:#f0f0f0; border-radius:4px; height:20px; overflow:hidden;">' +
        '<div style="width:' + rate + '%; background:' + color + '; height:100%; border-radius:4px;"></div></div>' +
        '<span style="width:36px; font-size:12px; font-weight:600; color:' + color + '; flex-shrink:0;">' + rate + '%</span></div>';
    }).join('');
    document.getElementById('bar-chart-card').style.display = 'block';

    // 明细表格
    // 选中单科目时按班级汇总行显示，多科目或全部时按科目分组展开
    const tbody = document.getElementById('stats-tbody');
    var isSingleSubject = selectedSubjects.length === 1;
    if (!isSingleSubject) {
      // 多科目/全部：按班级展开，每班下按科目分行
      var classSubjectStats = {};
      filtered.forEach(function(r) {
        var subName = r.homework_name ? r.homework_name.split('-')[0] : '未知';
        var classId = r.students && r.students.class_id;
        if (!classId || !classStatsMap[classId]) return;
        if (!classSubjectStats[classId]) classSubjectStats[classId] = {};
        if (!classSubjectStats[classId][subName]) {
          classSubjectStats[classId][subName] = { submitted: 0, excellent: 0, total: 0, hwNames: new Set() };
        }
        var stat = classSubjectStats[classId][subName];
        stat.total++;
        stat.hwNames.add(r.homework_name);
        if (r.status === '已交') stat.submitted++;
        else if (r.status === '优秀') { stat.submitted++; stat.excellent++; }
      });

      var rows = [];
      // 只显示选中的科目（空数组=全部）
      var displaySubjectNames = selectedSubjects.length > 0
        ? selectedSubjects
        : CONFIG.subjects.map(function(s) { return s.name; });
      sortedClasses.forEach(function(cls, idx) {
        if (idx > 0) {
          rows.push('<tr><td colspan="6" style="padding:0; height:12px; background:#fff; border:none;"></td></tr>');
        }
        rows.push('<tr style="background:#1a73e8;"><td colspan="6" style="font-weight:700; font-size:14px; color:#fff; padding:10px 12px; border-left:5px solid #0d47a1;">📋 ' + cls.name + '（' + cls.studentCount + '人）完成率:' + cls.rate + '%</td></tr>');
        var clsSubStats = classSubjectStats[cls.id];
        displaySubjectNames.forEach(function(subName) {
          var subDef = CONFIG.subjects.find(function(s) { return s.name === subName; });
          var subIcon = subDef ? subDef.icon : '';
          if (!clsSubStats || !clsSubStats[subName]) {
            rows.push('<tr style="background:#fafafa;"><td style="padding-left:24px;">' + subIcon + ' ' + subName + '</td><td colspan="5" style="text-align:center; color:#999; font-size:12px; padding:8px;">暂无作业</td></tr>');
          } else {
            var s = clsSubStats[subName];
            var hwCount = s.hwNames.size || 1;
            var expectedTotal = cls.studentCount * hwCount;
            // 未交 = 期望总数 - 已交（包含没有记录的学生）
            var pendingCount = Math.max(0, expectedTotal - s.submitted);
            var rate = expectedTotal > 0 ? Math.round(s.submitted / expectedTotal * 100) : 0;
            var color = rate >= 90 ? '#4caf50' : rate >= 70 ? '#ff9800' : '#f44336';
            // 跨日期时显示日均值
            var dSubmitted = dayCount > 1 ? Math.round((s.submitted - s.excellent) / dayCount) : (s.submitted - s.excellent);
            var dExcellent = dayCount > 1 ? Math.round(s.excellent / dayCount) : s.excellent;
            var dPending = dayCount > 1 ? Math.round(pendingCount / dayCount) : pendingCount;
            var dTotal = dayCount > 1 ? Math.round(expectedTotal / dayCount) : expectedTotal;
            var avgSuffix = dayCount > 1 ? '<span style="font-size:10px;color:#aaa;">均</span>' : '';
            rows.push('<tr style="background:#fafafa;"><td style="padding-left:24px;">' + subIcon + ' ' + subName + '</td><td>' + dSubmitted + avgSuffix + '</td><td>' + dExcellent + avgSuffix +
              '</td><td>' + dPending + avgSuffix + '</td><td>' + dTotal + avgSuffix +
              '</td><td style="color:' + color + '; font-weight:600;">' + rate + '%</td></tr>');
          }
        });
      });
      tbody.innerHTML = rows.join('');
    } else {
      // 单科目：每班一行汇总
      tbody.innerHTML = sortedClasses.map(function(s) {
        var rate = s.rate;
        var color = rate >= 90 ? '#4caf50' : rate >= 70 ? '#ff9800' : '#f44336';
        var hwCount = s.homeworkNames.size || 1;
        var expectedTotal = s.studentCount * hwCount;
        var pendingCount = Math.max(0, expectedTotal - s.submitted);
        // 跨日期时显示日均值
        var dSubmitted = dayCount > 1 ? Math.round((s.submitted - s.excellent) / dayCount) : (s.submitted - s.excellent);
        var dExcellent = dayCount > 1 ? Math.round(s.excellent / dayCount) : s.excellent;
        var dPending = dayCount > 1 ? Math.round(pendingCount / dayCount) : pendingCount;
        var dTotal = dayCount > 1 ? Math.round(expectedTotal / dayCount) : expectedTotal;
        var avgSuffix = dayCount > 1 ? '<span style="font-size:10px;color:#aaa;">均</span>' : '';
        return '<tr><td>' + s.name + '</td><td>' + dSubmitted + avgSuffix + '</td><td>' + dExcellent + avgSuffix +
          '</td><td>' + dPending + avgSuffix + '</td><td>' + dTotal + avgSuffix +
          '</td><td style="color:' + color + '; font-weight:600;">' + rate + '%</td></tr>';
      }).join('');
    }

    document.getElementById('table-date-range').textContent = startDate + ' ~ ' + endDate;
    document.getElementById('summary-table-card').style.display = 'block';

  } catch(e) {
    console.error(e);
    showToast('查询失败：' + e.message);
  } finally {
    document.getElementById('summary-loading').style.display = 'none';
  }
}

// ============================================================
// Tab 2: 班级明细（行=学生，列=日期×科目）
// ============================================================
async function loadClassDetail() {
  // 从多选复选框获取选中的科目
  var selectedSubjects = getSelectedCdSubjects();
  const classId = parseInt(document.getElementById('cd-class-select').value);
  const startDate = document.getElementById('cd-start-date').value;
  const endDate = document.getElementById('cd-end-date').value;

  if (!classId) { showToast('请选择班级'); return; }
  if (!startDate || !endDate) { showToast('请选择日期范围'); return; }
  if (startDate > endDate) { showToast('开始日期不能晚于结束日期'); return; }

  document.getElementById('cd-loading').style.display = 'flex';
  document.getElementById('cd-table-wrapper').style.display = 'none';
  document.getElementById('cd-empty').style.display = 'none';

  try {
    const students = await fetchStudents(classId);
    // 传 null 获取所有科目的记录，后面在前端过滤
    const records = await fetchClassRecordsByRange(classId, startDate, endDate, null);

    if (students.length === 0) {
      document.getElementById('cd-empty').style.display = 'flex';
      return;
    }

    // 按选中科目过滤记录
    var filteredRecords = records;
    if (selectedSubjects.length > 0) {
      filteredRecords = records.filter(function(r) {
        if (!r.homework_name) return false;
        var subPrefix = r.homework_name.indexOf('-') >= 0 ? r.homework_name.split('-')[0] : '';
        return selectedSubjects.indexOf(subPrefix) !== -1;
      });
    }

    // 确定日期和作业名列表
    const dateSet = new Set();
    const hwNameSet = new Set();
    filteredRecords.forEach(function(r) {
      dateSet.add(r.date);
      if (r.homework_name) hwNameSet.add(r.homework_name);
    });
    const dates = Array.from(dateSet).sort();
    const hwNames = Array.from(hwNameSet).sort();

    if (dates.length === 0) {
      document.getElementById('cd-empty').style.display = 'flex';
      return;
    }

    // 建立记录索引：studentId -> date -> homework_name -> status
    const recordIndex = {};
    filteredRecords.forEach(function(r) {
      const sid = r.student_id;
      if (!recordIndex[sid]) recordIndex[sid] = {};
      if (!recordIndex[sid][r.date]) recordIndex[sid][r.date] = {};
      recordIndex[sid][r.date][r.homework_name] = r.status;
    });

    // 辅助：根据科目色生成状态单元格（带科目色分组背景）
    function statusCell(status, subColor, isFirstInSubject) {
      var borderLeft = isFirstInSubject ? ('border-left:2px solid ' + (subColor || '#ddd') + ';') : '';
      if (!status || status === '未交') {
        return '<td data-status="未交" style="background:#ffebee; color:#f44336; text-align:center; font-size:13px;' + borderLeft + '">✗</td>';
      }
      const def = CONFIG.statuses.find(function(s) { return s.name === status; });
      return '<td data-status="' + status + '" style="background:' + (def ? def.bgColor : '#eee') + '; color:' + (def ? def.textColor : '#333') + '; text-align:center; font-size:13px;' + borderLeft + '">' + (def ? def.icon : status) + '</td>';
    }

    // 列头：日期×作业名（按完整 homework_name 显示）
    const colHeaders = [];
    dates.forEach(function(d) {
      hwNames.forEach(function(hw) {
        // 检查该日期是否有该作业的记录
        var hasRecord = filteredRecords.some(function(r) { return r.date === d && r.homework_name === hw; });
        if (hasRecord) {
          var subPrefix = hw.indexOf('-') >= 0 ? hw.split('-')[0] : '';
          var subDef = CONFIG.subjects.find(function(s) { return s.name === subPrefix; });
          colHeaders.push({ date: d, hwName: hw, subPrefix: subPrefix, subDef: subDef });
        }
      });
    });

    // 按日期分组列头
    var dateColCount = {};
    colHeaders.forEach(function(col) {
      dateColCount[col.date] = (dateColCount[col.date] || 0) + 1;
    });

    const thead = document.getElementById('cd-thead');
    var headerRow1 = '<tr><th rowspan="2" style="min-width:60px;">学生</th>';
    dates.forEach(function(d) {
      if (dateColCount[d]) {
        headerRow1 += '<th colspan="' + dateColCount[d] + '" style="text-align:center; font-size:11px;">' + d.slice(5) + '</th>';
      }
    });
    headerRow1 += '</tr>';

    // 计算每列是否是该科目在当前日期内的第一列（用于加左边框）
    var prevSubKey = null;
    var headerRow2 = '<tr>';
    colHeaders.forEach(function(col) {
      var shortName = col.hwName.indexOf('-') >= 0 ? col.hwName.slice(col.hwName.indexOf('-') + 1) : col.hwName;
      var subColor = col.subDef ? col.subDef.color : null;
      // 科目切换时加左边框
      var subKey = col.date + '|' + col.subPrefix;
      var isFirst = (subKey !== prevSubKey);
      prevSubKey = subKey;
      var bgStyle = subColor ? ('background:' + subColor + '18;') : '';
      var borderStyle = (isFirst && subColor) ? ('border-left:2px solid ' + subColor + ';') : '';
      var label = col.subDef
        ? (col.subDef.icon + ' ' + col.subPrefix + '<br><span style="font-weight:400;">' + shortName + '</span>')
        : shortName;
      headerRow2 += '<th style="font-size:10px; min-width:40px; line-height:1.4; padding:4px 2px;' + bgStyle + borderStyle + '" title="' + col.hwName + '">' + label + '</th>';
    });
    headerRow2 += '</tr>';
    thead.innerHTML = headerRow1 + headerRow2;

    const tbody = document.getElementById('cd-tbody');
    tbody.innerHTML = students.map(function(student) {
      const label = student.name || (student.student_number + '号');
      var prevSubKey2 = null;
      const cells = colHeaders.map(function(col) {
        const status = (recordIndex[student.id] && recordIndex[student.id][col.date] && recordIndex[student.id][col.date][col.hwName]) || '未交';
        var subColor = col.subDef ? col.subDef.color : null;
        var subKey2 = col.date + '|' + col.subPrefix;
        var isFirst2 = (subKey2 !== prevSubKey2);
        prevSubKey2 = subKey2;
        return statusCell(status, subColor, isFirst2);
      }).join('');
      return '<tr><td style="font-size:12px; white-space:nowrap; padding:4px 6px;">' + label + '</td>' + cells + '</tr>';
    }).join('');

    document.getElementById('cd-table-wrapper').style.display = 'block';

  } catch(e) {
    console.error(e);
    showToast('查询失败：' + e.message);
    document.getElementById('cd-empty').style.display = 'flex';
  } finally {
    document.getElementById('cd-loading').style.display = 'none';
  }
}

// ============================================================
// Tab 3: 个人统计
// ============================================================
async function loadStudentsForPersonal() {
  const classId = parseInt(document.getElementById('p-class-select').value);
  const select = document.getElementById('p-student-select');
  select.innerHTML = '<option value="">加载中...</option>';
  if (!classId) { select.innerHTML = '<option value="">请先选择班级</option>'; return; }
  try {
    const students = await fetchStudents(classId);
    select.innerHTML = '<option value="">请选择学生</option>' +
      students.map(function(s) {
        return '<option value="' + s.id + '">' + (s.name || (s.student_number + '号')) + '</option>';
      }).join('');
  } catch(e) {
    select.innerHTML = '<option value="">加载失败</option>';
  }
}

async function loadPersonalStats() {
  var studentId = parseInt(document.getElementById('p-student-select').value);
  var startDate = document.getElementById('p-start-date').value;
  var endDate = document.getElementById('p-end-date').value;
  var selectedSubjects = getSelectedPSubjects();

  if (!studentId) { showToast('请选择学生'); return; }
  if (!startDate || !endDate) { showToast('请选择日期范围'); return; }
  if (startDate > endDate) { showToast('开始日期不能晚于结束日期'); return; }

  document.getElementById('p-loading').style.display = 'flex';
  document.getElementById('p-result').style.display = 'none';
  document.getElementById('p-empty').style.display = 'none';

  try {
    var records = await fetchStudentRecordsByRange(studentId, startDate, endDate);

    // 按选中科目过滤
    if (selectedSubjects.length > 0) {
      records = records.filter(function(r) {
        if (!r.homework_name) return false;
        var subPrefix = r.homework_name.indexOf('-') >= 0 ? r.homework_name.split('-')[0] : '';
        return selectedSubjects.indexOf(subPrefix) !== -1;
      });
    }

    if (records.length === 0) {
      document.getElementById('p-empty').style.display = 'flex';
      return;
    }

    // 建立索引：date -> homework_name -> status（按完整作业名）
    var index = {};
    var dateSet = new Set();
    var hwNameSet = new Set();
    records.forEach(function(r) {
      dateSet.add(r.date);
      hwNameSet.add(r.homework_name);
      if (!index[r.date]) index[r.date] = {};
      index[r.date][r.homework_name] = r.status;
    });

    var dates = Array.from(dateSet).sort();
    var hwNames = Array.from(hwNameSet).sort();

    if (hwNames.length === 0) {
      document.getElementById('p-empty').style.display = 'flex';
      return;
    }

    // 各作业汇总
    var hwSummary = {};
    hwNames.forEach(function(hw) { hwSummary[hw] = { submitted: 0, excellent: 0, pending: 0, total: 0 }; });
    dates.forEach(function(d) {
      hwNames.forEach(function(hw) {
        var status = index[d] && index[d][hw];
        if (!status) return;
        var s = hwSummary[hw];
        s.total++;
        if (status === '已交') s.submitted++;
        else if (status === '优秀') { s.submitted++; s.excellent++; }
        else if (status === '未交') s.pending++;
      });
    });

    // 学生名称
    var studentSelect = document.getElementById('p-student-select');
    var selectedOpt = studentSelect.options[studentSelect.selectedIndex];
    var studentName = selectedOpt ? selectedOpt.text : '学生';
    document.getElementById('p-student-name').textContent = studentName + ' · ' + startDate + ' ~ ' + endDate;

    // 汇总卡片（按作业维度显示）
    document.getElementById('p-summary-row').innerHTML = hwNames.map(function(hw) {
      var s = hwSummary[hw];
      var rate = s.total > 0 ? Math.round(s.submitted / s.total * 100) : 0;
      var subPrefix = hw.indexOf('-') >= 0 ? hw.split('-')[0] : '';
      var shortName = hw.indexOf('-') >= 0 ? hw.slice(hw.indexOf('-') + 1) : hw;
      var def = CONFIG.subjects.find(function(sd) { return sd.name === subPrefix; });
      var color = rate >= 90 ? '#4caf50' : rate >= 70 ? '#ff9800' : '#f44336';
      return '<div style="text-align:center; padding:6px 10px; background:var(--bg); border-radius:8px;">' +
        '<div style="font-size:18px; font-weight:700; color:' + color + ';">' + rate + '%</div>' +
        '<div style="font-size:11px; color:var(--text-secondary);">' + (def ? def.icon : '') + ' ' + shortName + '</div>' +
        '<div style="font-size:10px; color:var(--text-secondary);">未交' + s.pending + '次</div></div>';
    }).join('');

    // 预处理 hwNames：附带科目信息
    var hwCols = hwNames.map(function(hw) {
      var subPrefix = hw.indexOf('-') >= 0 ? hw.split('-')[0] : '';
      var shortName = hw.indexOf('-') >= 0 ? hw.slice(hw.indexOf('-') + 1) : hw;
      var subDef = CONFIG.subjects.find(function(s) { return s.name === subPrefix; });
      return { hw: hw, subPrefix: subPrefix, shortName: shortName, subDef: subDef };
    });

    // 明细表格：行=日期，列=作业名（带科目色分组）
    var thead = document.getElementById('p-thead');
    var prevSubP = null;
    thead.innerHTML = '<tr><th style="min-width:70px;">日期</th>' +
      hwCols.map(function(col) {
        var subColor = col.subDef ? col.subDef.color : null;
        var isFirst = (col.subPrefix !== prevSubP);
        prevSubP = col.subPrefix;
        var bgStyle = subColor ? ('background:' + subColor + '18;') : '';
        var borderStyle = (isFirst && subColor) ? ('border-left:2px solid ' + subColor + ';') : '';
        var label = col.subDef
          ? (col.subDef.icon + ' ' + col.subPrefix + '<br><span style="font-weight:400;">' + col.shortName + '</span>')
          : col.shortName;
        return '<th style="min-width:40px; font-size:10px; line-height:1.4; padding:4px 2px;' + bgStyle + borderStyle + '" title="' + col.hw + '">' + label + '</th>';
      }).join('') + '</tr>';

    var tbody = document.getElementById('p-tbody');
    tbody.innerHTML = dates.map(function(d) {
      var hasPending = hwCols.some(function(col) {
        return ((index[d] && index[d][col.hw]) ? index[d][col.hw] : '未交') === '未交';
      });
      var prevSubP2 = null;
      var cells = hwCols.map(function(col) {
        var status = (index[d] && index[d][col.hw]) ? index[d][col.hw] : '--';
        var subColor = col.subDef ? col.subDef.color : null;
        var isFirst2 = (col.subPrefix !== prevSubP2);
        prevSubP2 = col.subPrefix;
        var borderStyle = (isFirst2 && subColor) ? ('border-left:2px solid ' + subColor + ';') : '';
        if (status === '--') {
          return '<td style="text-align:center; color:#ccc; font-size:13px;' + borderStyle + '">--</td>';
        }
        var def = CONFIG.statuses.find(function(s) { return s.name === status; });
        var isPending = status === '未交';
        return '<td style="text-align:center; background:' + (isPending ? '#ffebee' : (def ? def.bgColor : '#eee')) +
          '; color:' + (isPending ? '#f44336' : (def ? def.textColor : '#333')) +
          '; font-size:13px;' + borderStyle + '">' + (isPending ? '✗' : (def ? def.icon : status)) + '</td>';
      }).join('');
      return '<tr style="' + (hasPending ? 'background:#fff8f8;' : '') + '">' +
        '<td style="font-size:12px; white-space:nowrap; padding:4px 6px;">' + d.slice(5) + '</td>' + cells + '</tr>';
    }).join('');

    document.getElementById('p-result').style.display = 'block';

  } catch(e) {
    console.error(e);
    showToast('查询失败：' + e.message);
    document.getElementById('p-empty').style.display = 'flex';
  } finally {
    document.getElementById('p-loading').style.display = 'none';
  }
}

// ============================================================
// 班级明细状态筛选
// ============================================================
function filterClassDetail(status) {
  currentDetailFilter = status;
  // 更新筛选按钮样式
  var btns = document.querySelectorAll('.cd-filter-btn');
  btns.forEach(function(btn) {
    var btnStatus = btn.getAttribute('data-status');
    if (btnStatus === status) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'var(--bg)';
      btn.style.color = 'var(--text-secondary)';
    }
  });
  // 筛选表格行
  var tbody = document.getElementById('cd-tbody');
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(row) {
    if (!status) {
      // 全部：显示所有行
      row.style.display = '';
      return;
    }
    // 检查该行是否有匹配的状态单元格
    var cells = row.querySelectorAll('td[data-status]');
    var hasMatch = false;
    cells.forEach(function(cell) {
      if (cell.getAttribute('data-status') === status) {
        hasMatch = true;
      }
    });
    row.style.display = hasMatch ? '' : 'none';
  });
}

// ============================================================
// 导出
// ============================================================
function exportSummaryExcel() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  // 科目已改为多选复选框，取第一个选中的科目（或空字符串表示全部）
  var selectedSubjects = getSelectedSummarySubjects();
  var subject = selectedSubjects.length === 1 ? selectedSubjects[0] : '';
  if (!startDate || !endDate) { showToast('请先查询统计数据'); return; }
  exportExcel(startDate, endDate, subject);
}

function exportClassDetailExcel() {
  const classId = parseInt(document.getElementById('cd-class-select').value);
  const startDate = document.getElementById('cd-start-date').value;
  const endDate = document.getElementById('cd-end-date').value;
  // 科目已改为多选复选框，取第一个选中的科目（或 null 表示全部）
  var cdSubjects = getSelectedCdSubjects();
  var subject = cdSubjects.length === 1 ? cdSubjects[0] : null;
  if (!classId || !startDate || !endDate) { showToast('请先查询班级明细数据'); return; }
  exportClassDetailToExcel(classId, startDate, endDate, subject);
}

// ============================================================
// 班级明细 & 个人统计 科目多选
// ============================================================
var selectedCdSubjects = []; // 班级明细选中的科目
var selectedPSubjects = [];  // 个人统计选中的科目

function renderCdSubjectCheckboxes() {
  var container = document.getElementById('cd-subject-checkboxes');
  if (!container) return;
  container.innerHTML = CONFIG.subjects.map(function(s) {
    var checked = selectedCdSubjects.length === 0 || selectedCdSubjects.indexOf(s.name) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:16px; border:1.5px solid ' + (checked ? s.color : 'var(--border)') + '; background:' + (checked ? s.color + '18' : '#fff') + '; cursor:pointer; font-size:12px; color:' + (checked ? s.color : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onCdSubjectChange(\'' + s.name + '\', this.checked)" style="display:none;">' +
      s.icon + ' ' + s.name +
      '</label>';
  }).join('');
}

function onCdSubjectChange(subjectName, checked) {
  if (selectedCdSubjects.length === 0) {
    // 从全选状态开始，取消一个
    selectedCdSubjects = CONFIG.subjects.map(function(s) { return s.name; });
  }
  if (checked) {
    if (selectedCdSubjects.indexOf(subjectName) === -1) selectedCdSubjects.push(subjectName);
  } else {
    selectedCdSubjects = selectedCdSubjects.filter(function(n) { return n !== subjectName; });
  }
  // 如果全部选中，重置为空数组（表示全部）
  if (selectedCdSubjects.length === CONFIG.subjects.length) selectedCdSubjects = [];
  renderCdSubjectCheckboxes();
}

function getSelectedCdSubjects() {
  return selectedCdSubjects;
}

function renderPSubjectCheckboxes() {
  var container = document.getElementById('p-subject-checkboxes');
  if (!container) return;
  container.innerHTML = CONFIG.subjects.map(function(s) {
    var checked = selectedPSubjects.length === 0 || selectedPSubjects.indexOf(s.name) !== -1;
    return '<label style="display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:16px; border:1.5px solid ' + (checked ? s.color : 'var(--border)') + '; background:' + (checked ? s.color + '18' : '#fff') + '; cursor:pointer; font-size:12px; color:' + (checked ? s.color : 'var(--text)') + ';">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="onPSubjectChange(\'' + s.name + '\', this.checked)" style="display:none;">' +
      s.icon + ' ' + s.name +
      '</label>';
  }).join('');
}

function onPSubjectChange(subjectName, checked) {
  if (selectedPSubjects.length === 0) {
    selectedPSubjects = CONFIG.subjects.map(function(s) { return s.name; });
  }
  if (checked) {
    if (selectedPSubjects.indexOf(subjectName) === -1) selectedPSubjects.push(subjectName);
  } else {
    selectedPSubjects = selectedPSubjects.filter(function(n) { return n !== subjectName; });
  }
  if (selectedPSubjects.length === CONFIG.subjects.length) selectedPSubjects = [];
  renderPSubjectCheckboxes();
}

function getSelectedPSubjects() {
  return selectedPSubjects;
}

// ============================================================
// 班级/科目筛选面板
// ============================================================
var visibleClassIdsLocal = null;
var visibleSubjectsLocal = null;

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
  // 筛选面板已改为常驻顶部，此函数保留但不再切换显示/隐藏
  renderFilterCheckboxes();
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
  updateFilterBtnHighlight();
}

function selectAllClasses() {
  visibleClassIdsLocal = null;
  saveFilterState();
  renderFilterCheckboxes();
  updateFilterBtnHighlight();
}

function clearAllClasses() {
  visibleClassIdsLocal = [];
  saveFilterState();
  renderFilterCheckboxes();
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
  updateFilterBtnHighlight();
}

function selectAllSubjects() {
  visibleSubjectsLocal = null;
  saveFilterState();
  renderSubjectFilterCheckboxes();
  updateFilterBtnHighlight();
}

function clearAllSubjects() {
  visibleSubjectsLocal = [];
  saveFilterState();
  renderSubjectFilterCheckboxes();
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

  // 强制登录检查：未登录跳转到登录页
  try {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) {
      window.location.href = 'admin.html?from=stats';
      return;
    }
    adminUser = user;
  } catch(e) {
    window.location.href = 'admin.html?from=stats';
    return;
  }
  updateAdminUI();
  getSupabase().auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'admin.html';
      return;
    }
    adminUser = session ? session.user : null;
    updateAdminUI();
  });
  // btn-admin-toggle 的 onclick 已在 HTML 中设置为 toggleAdminMenu()

  // 默认日期：今天
  const today = getTodayStr();
  ['start-date', 'cd-start-date', 'p-start-date'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
  ['end-date', 'cd-end-date', 'p-end-date'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  // 加载班级列表
  try {
    classesData = await fetchClasses();
  } catch(e) {
    showToast('加载班级失败：' + e.message);
    return;
  }

  // 填充班级下拉
  const classOptions = '<option value="">请选择班级</option>' +
    classesData.map(function(c) {
      return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join('');
  ['cd-class-select', 'p-class-select'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = classOptions;
  });

  // 加载筛选状态
  loadFilterState();
  updateFilterBtnHighlight();

  // 渲染 Tab1 班级多选复选框
  renderSummaryClassCheckboxes();

  // 渲染 Tab1 科目多选复选框
  renderSummarySubjectCheckboxes();

  // 渲染 Tab2/Tab3 科目多选复选框
  renderCdSubjectCheckboxes();
  renderPSubjectCheckboxes();

  // 初始显示 Tab 1
  switchStatsTab('summary');
}

document.addEventListener('DOMContentLoaded', init);
