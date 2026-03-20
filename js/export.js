// ============================================================
// Excel 导出逻辑（使用 SheetJS）
// ============================================================

/**
 * 导出统计汇总数据到 Excel
 * @param {Object} statsData - 来自 stats.js 的 currentStatsData
 */
function exportStatsToExcel(statsData) {
  const { classStats, startDate, endDate, homeworkFilter, rawRecords } = statsData;

  const wb = XLSX.utils.book_new();

  // ============================================================
  // Sheet 1：各班汇总
  // ============================================================
  const summaryRows = [
    ['班级', '已交', '补交', '免交', '未交', '总人次', '完成率(%)'],
  ];

  let sumYJ = 0, sumBJ = 0, sumMJ = 0, sumWJ = 0, sumTotal = 0;

  const sorted = Object.values(classStats)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  sorted.forEach(cls => {
    const submitted = cls['已交'] + cls['补交'] + cls['免交'];
    const total = submitted + cls['未交'];
    if (total === 0) return;
    const rate = total > 0 ? Math.round(submitted / total * 100) : 0;
    summaryRows.push([
      cls.name,
      cls['已交'],
      cls['补交'],
      cls['免交'],
      cls['未交'],
      total,
      rate,
    ]);
    sumYJ += cls['已交'];
    sumBJ += cls['补交'];
    sumMJ += cls['免交'];
    sumWJ += cls['未交'];
    sumTotal += total;
  });

  const sumSubmitted = sumYJ + sumBJ + sumMJ;
  const sumRate = sumTotal > 0 ? Math.round(sumSubmitted / sumTotal * 100) : 0;
  summaryRows.push(['合计', sumYJ, sumBJ, sumMJ, sumWJ, sumTotal, sumRate]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

  // 设置列宽
  wsSummary['!cols'] = [
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, '各班汇总');

  // ============================================================
  // Sheet 2：明细记录
  // ============================================================
  const detailRows = [
    ['日期', '作业名称', '班级', '学号', '姓名', '状态'],
  ];

  rawRecords
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aOrder = a.students?.classes?.display_order || 0;
      const bOrder = b.students?.classes?.display_order || 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.students?.student_number || 0) - (b.students?.student_number || 0);
    })
    .forEach(r => {
      detailRows.push([
        r.date,
        r.homework_name,
        r.students?.classes?.name || '--',
        r.students?.student_number || '--',
        r.students?.name || '',
        r.status,
      ]);
    });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 8 },
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, '明细记录');

  // ============================================================
  // 生成文件名
  // ============================================================
  const hwLabel = homeworkFilter ? `_${homeworkFilter}` : '';
  const filename = `作业统计_${startDate}_${endDate}${hwLabel}.xlsx`;

  XLSX.writeFile(wb, filename);
}

/**
 * 导出单班单日数据到 Excel
 * @param {string} className - 班级名称
 * @param {string} date - 日期
 * @param {string} homeworkName - 作业名称
 * @param {Array} students - 学生列表
 * @param {Object} recordsMap - { student_id: status }
 */
function exportClassToExcel(className, date, homeworkName, students, recordsMap) {
  const wb = XLSX.utils.book_new();

  const rows = [['学号', '姓名', '作业状态']];

  students.forEach(function(s) {
    rows.push([s.student_number, s.name || '', recordsMap[s.id] || '未交']);
  });

  const counts = { '已交': 0, '优秀': 0, '未交': 0 };
  students.forEach(function(s) {
    const status = recordsMap[s.id] || '未交';
    if (counts[status] !== undefined) counts[status]++;
  });
  const submitted = counts['已交'] + counts['优秀'];
  const total = students.length;
  const rate = total > 0 ? Math.round(submitted / total * 100) : 0;

  rows.push([]);
  rows.push(['已交', counts['已交'], '']);
  rows.push(['优秀', counts['优秀'], '']);
  rows.push(['未交', counts['未交'], '']);
  rows.push(['完成率', rate + '%', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, className + '_' + homeworkName);

  XLSX.writeFile(wb, className + '_' + homeworkName + '_' + date + '.xlsx');
}

// ============================================================
// 统计页 Tab1 导出：班级汇总（按日期范围+科目）
// ============================================================
/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} subject - 科目名，空字符串表示全部
 */
async function exportExcel(startDate, endDate, subject) {
  try {
    const records = await fetchRecordsByDateRange(startDate, endDate);
    const filtered = subject ? records.filter(function(r) { return r.homework_name === subject; }) : records;

    const classesData = await fetchClasses();
    const classMap = {};
    classesData.forEach(function(c) { classMap[c.id] = c; });

    // 各班汇总
    const classStatsMap = {};
    classesData.forEach(function(cls) {
      classStatsMap[cls.id] = { name: cls.name, displayOrder: cls.display_order, submitted: 0, excellent: 0, pending: 0, total: 0 };
    });
    filtered.forEach(function(r) {
      const classId = r.students && r.students.class_id;
      if (!classId || !classStatsMap[classId]) return;
      const s = classStatsMap[classId];
      s.total++;
      if (r.status === '已交') s.submitted++;
      else if (r.status === '优秀') { s.submitted++; s.excellent++; }
      else if (r.status === '未交') s.pending++;
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1：各班汇总
    const summaryRows = [['班级', '已交', '优秀', '未交', '总人次', '完成率(%)']];
    const sorted = Object.values(classStatsMap)
      .filter(function(s) { return s.total > 0; })
      .sort(function(a, b) { return a.displayOrder - b.displayOrder; });
    sorted.forEach(function(s) {
      const rate = s.total > 0 ? Math.round(s.submitted / s.total * 100) : 0;
      summaryRows.push([s.name, s.submitted - s.excellent, s.excellent, s.pending, s.total, rate]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, '各班汇总');

    // Sheet 2：明细记录
    const detailRows = [['日期', '科目', '班级', '学号', '姓名', '状态']];
    filtered
      .sort(function(a, b) {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const aO = (a.students && a.students.classes && a.students.classes.display_order) || 0;
        const bO = (b.students && b.students.classes && b.students.classes.display_order) || 0;
        if (aO !== bO) return aO - bO;
        return ((a.students && a.students.student_number) || 0) - ((b.students && b.students.student_number) || 0);
      })
      .forEach(function(r) {
        detailRows.push([
          r.date,
          r.homework_name,
          (r.students && r.students.classes && r.students.classes.name) || '--',
          (r.students && r.students.student_number) || '--',
          (r.students && r.students.name) || '',
          r.status,
        ]);
      });
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, '明细记录');

    const subjectLabel = subject ? '_' + subject : '';
    XLSX.writeFile(wb, '作业统计_' + startDate + '_' + endDate + subjectLabel + '.xlsx');
  } catch(e) {
    alert('导出失败：' + e.message);
  }
}

// ============================================================
// 统计页 Tab2 导出：班级学生明细（学生×日期×科目矩阵）
// ============================================================
/**
 * @param {number} classId
 * @param {string} startDate
 * @param {string} endDate
 * @param {string|null} subject - null 表示全部科目
 */
async function exportClassDetailToExcel(classId, startDate, endDate, subject) {
  try {
    const students = await fetchStudents(classId);
    const records = await fetchClassRecordsByRange(classId, startDate, endDate, subject);

    const dateSet = new Set();
    const subjectSet = new Set();
    records.forEach(function(r) { dateSet.add(r.date); subjectSet.add(r.homework_name); });
    const dates = Array.from(dateSet).sort();
    const subjects = subject
      ? [subject]
      : CONFIG.subjects.map(function(s) { return s.name; }).filter(function(n) { return subjectSet.has(n); });

    // 建立索引
    const recordIndex = {};
    records.forEach(function(r) {
      const sid = r.student_id;
      if (!recordIndex[sid]) recordIndex[sid] = {};
      if (!recordIndex[sid][r.date]) recordIndex[sid][r.date] = {};
      recordIndex[sid][r.date][r.homework_name] = r.status;
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1：学生×日期×科目 矩阵
    // 表头：学生 | 日期1-科目1 | 日期1-科目2 | ...
    const colHeaders = [];
    dates.forEach(function(d) {
      subjects.forEach(function(sub) {
        colHeaders.push(d.slice(5) + ' ' + sub);
      });
    });
    const headerRow = ['学号', '姓名'].concat(colHeaders);
    const dataRows = [headerRow];

    students.forEach(function(student) {
      const row = [student.student_number, student.name || ''];
      dates.forEach(function(d) {
        subjects.forEach(function(sub) {
          const status = (recordIndex[student.id] && recordIndex[student.id][d] && recordIndex[student.id][d][sub]) || '未交';
          row.push(status);
        });
      });
      dataRows.push(row);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(dataRows);
    const colWidths = [{ wch: 6 }, { wch: 12 }];
    colHeaders.forEach(function() { colWidths.push({ wch: 10 }); });
    ws1['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws1, '学生明细');

    // Sheet 2：各科目完成率汇总
    const summaryRows = [['学号', '姓名'].concat(subjects.map(function(s) { return s + '完成率'; })).concat(['总完成率'])];
    students.forEach(function(student) {
      const row = [student.student_number, student.name || ''];
      let totalSubmitted = 0, totalCount = 0;
      subjects.forEach(function(sub) {
        let submitted = 0, count = 0;
        dates.forEach(function(d) {
          const status = (recordIndex[student.id] && recordIndex[student.id][d] && recordIndex[student.id][d][sub]) || '未交';
          count++;
          if (status === '已交' || status === '优秀') submitted++;
        });
        totalSubmitted += submitted;
        totalCount += count;
        row.push(count > 0 ? Math.round(submitted / count * 100) + '%' : '--');
      });
      row.push(totalCount > 0 ? Math.round(totalSubmitted / totalCount * 100) + '%' : '--');
      summaryRows.push(row);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, '完成率汇总');

    const cls = await fetchClasses().then(function(list) { return list.find(function(c) { return c.id === classId; }); });
    const clsName = cls ? cls.name : ('班级' + classId);
    const subLabel = subject ? '_' + subject : '';
    XLSX.writeFile(wb, clsName + '_明细_' + startDate + '_' + endDate + subLabel + '.xlsx');
  } catch(e) {
    alert('导出失败：' + e.message);
  }
}