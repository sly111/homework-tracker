// ============================================================
// Supabase 客户端初始化
// ============================================================

// 使用 Supabase CDN 版本（在 HTML 中引入）
let supabaseClient = null;

function initSupabase() {
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl === 'YOUR_SUPABASE_URL') {
    console.error('请在 js/config.js 中配置 Supabase URL 和 Key');
    showConfigError();
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}

function showConfigError() {
  const errorDiv = document.getElementById('config-error');
  if (errorDiv) {
    errorDiv.style.display = 'block';
  }
}

// ============================================================
// 认证相关
// ============================================================

async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function isAdmin() {
  const user = await getCurrentUser();
  return user !== null;
}

async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

// ============================================================
// 班级数据
// ============================================================

async function fetchClasses() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('classes')
    .select('*')
    .order('display_order');
  if (error) throw error;
  return data;
}

async function fetchStudents(classId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('student_number');
  if (error) throw error;
  return data;
}

// ============================================================
// 作业记录
// ============================================================

async function fetchHomeworkRecords(classId, date, homeworkName) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('*, students!inner(class_id, student_number)')
    .eq('students.class_id', classId)
    .eq('date', date)
    .eq('homework_name', homeworkName);
  if (error) throw error;
  return data;
}

async function fetchAllRecordsForDate(date, subject) {
  const sb = getSupabase();
  let query = sb
    .from('homework_records')
    .select('*, students!inner(class_id, student_number, classes(name))')
    .eq('date', date);
  // subject 为科目名（如"语文"），数据库中 homework_name 格式为"语文-默写"
  // 按前缀匹配；若 subject 为空则查全部
  if (subject) {
    query = query.like('homework_name', subject + '-%');
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function upsertHomeworkRecord(studentId, date, homeworkName, status, updatedBy) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .upsert({
      student_id: studentId,
      date: date,
      homework_name: homeworkName,
      status: status,
      updated_by: updatedBy || 'admin',
    }, {
      onConflict: 'student_id,date,homework_name',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchRecordsByDateRange(startDate, endDate) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('*, students!inner(student_number, class_id, name, classes(name, display_order))')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('homework_name');
  if (error) throw error;
  return data;
}

async function fetchDistinctDates() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('date')
    .order('date', { ascending: false });
  if (error) throw error;
  // 去重
  const dates = [...new Set(data.map(r => r.date))];
  return dates;
}

async function fetchDistinctHomeworkNames(classId, date) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('homework_name, students!inner(class_id)')
    .eq('students.class_id', classId)
    .eq('date', date);
  if (error) throw error;
  const names = [...new Set(data.map(r => r.homework_name))];
  if (names.length === 0) names.push('作业1');
  return names;
}

// ============================================================
// 统计数据
// ============================================================

async function fetchClassStats(date, homeworkName) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('status, students!inner(class_id, classes(id, name, student_count, display_order))')
    .eq('date', date)
    .eq('homework_name', homeworkName);
  if (error) throw error;
  return data;
}

// ============================================================
// 科目数据
// ============================================================

async function fetchSubjects() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('subjects')
    .select('*')
    .order('display_order');
  if (error) throw error;
  return data;
}

// ============================================================
// 学生姓名修改（需管理员权限）
// ============================================================

async function updateStudentName(studentId, name) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('students')
    .update({ name: name.trim() })
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// 按科目查询班级作业记录
// ============================================================

async function fetchHomeworkRecordsBySubject(classId, date, subject) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('*, students!inner(id, class_id, student_number, name)')
    .eq('students.class_id', classId)
    .eq('date', date)
    .eq('homework_name', subject);
  if (error) throw error;
  return data;
}

// ============================================================
// 查询单个学生多日多科目记录（用于个人统计）
// ============================================================

async function fetchStudentRecordsByRange(studentId, startDate, endDate) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('homework_records')
    .select('date, homework_name, status')
    .eq('student_id', studentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('homework_name');
  if (error) throw error;
  return data;
}

// ============================================================
// 查询某班某日某科目下已有的所有作业名称
// homework_name 格式为"科目-作业名"，如"语文-默写"
// ============================================================

async function fetchHomeworkNamesForSubject(classId, date, subject) {
  const sb = getSupabase();
  const prefix = subject + '-';
  const { data, error } = await sb
    .from('homework_records')
    .select('homework_name, students!inner(class_id)')
    .eq('students.class_id', classId)
    .eq('date', date)
    .like('homework_name', prefix + '%');
  if (error) throw error;
  const names = [...new Set(data.map(function(r) { return r.homework_name; }))];
  return names.sort();
}

// ============================================================
// 删除某份作业的所有记录（管理员删除作业时用）
// ============================================================

async function deleteHomeworkRecordsForName(classId, date, homeworkName) {
  const sb = getSupabase();
  // 先获取该班学生ID列表
  const { data: students, error: sErr } = await sb
    .from('students')
    .select('id')
    .eq('class_id', classId);
  if (sErr) throw sErr;
  const studentIds = students.map(function(s) { return s.id; });
  if (studentIds.length === 0) return;
  const { error } = await sb
    .from('homework_records')
    .delete()
    .in('student_id', studentIds)
    .eq('date', date)
    .eq('homework_name', homeworkName);
  if (error) throw error;
}

// ============================================================
// 科目 CRUD（管理员用）
// ============================================================

async function insertSubject(name, icon, color) {
  const sb = getSupabase();
  // 获取当前最大 display_order
  const { data: existing } = await sb.from('subjects').select('display_order').order('display_order', { ascending: false }).limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 1;
  const { data, error } = await sb
    .from('subjects')
    .insert({ name: name.trim(), icon: icon || '', color: color || '#666666', display_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteSubjectById(id) {
  const sb = getSupabase();
  const { error } = await sb.from('subjects').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 班级 CRUD（管理员用）
// ============================================================

async function insertClass(name, studentCount, displayOrder) {
  const sb = getSupabase();
  const { data: existing } = await sb.from('classes').select('display_order').order('display_order', { ascending: false }).limit(1);
  const nextOrder = displayOrder || (existing && existing.length > 0 ? existing[0].display_order + 1 : 1);
  const { data, error } = await sb
    .from('classes')
    .insert({ name: name.trim(), student_count: parseInt(studentCount) || 0, display_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteClassById(id) {
  const sb = getSupabase();
  // 删除该班所有作业记录
  const { data: students } = await sb.from('students').select('id').eq('class_id', id);
  if (students && students.length > 0) {
    const ids = students.map(function(s) { return s.id; });
    await sb.from('homework_records').delete().in('student_id', ids);
  }
  // 删除该班所有学生
  await sb.from('students').delete().eq('class_id', id);
  // 删除班级
  const { error } = await sb.from('classes').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 查询整班多日多科目记录（用于班级学生明细统计）
// ============================================================

async function fetchClassRecordsByRange(classId, startDate, endDate, subject) {
  const sb = getSupabase();
  let query = sb
    .from('homework_records')
    .select('student_id, date, homework_name, status, students!inner(id, class_id, student_number, name)')
    .eq('students.class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('homework_name');

  if (subject) {
    query = query.like('homework_name', subject + '-%');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================
// 获取日期范围内的所有记录（含学生信息）
// ============================================================

async function fetchAllRecordsForDateRange(startDate, endDate, subject) {
  var query = getSupabase()
    .from('homework_records')
    .select('*, students!inner(id, student_number, name, class_id)')
    .gte('date', startDate)
    .lte('date', endDate);
  if (subject) {
    query = query.like('homework_name', subject + '-%');
  }
  var { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// 批量重命名当天所有班级的作业名
// ============================================================

async function renameHomeworkRecords(date, oldName, newName) {
  var { data, error } = await getSupabase()
    .from('homework_records')
    .update({ homework_name: newName })
    .eq('date', date)
    .eq('homework_name', oldName);
  if (error) throw error;
  return data;
}

// ============================================================
// 科目重命名（管理员用）
// ============================================================

async function updateSubjectName(id, name) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('subjects')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// 班级重命名（管理员用）
// ============================================================

async function updateClassName(id, name) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('classes')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// 学生 CRUD（管理员用）
// ============================================================

async function insertStudent(classId, studentNumber, name) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('students')
    .insert({ class_id: classId, student_number: studentNumber, name: name ? name.trim() : null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteStudentById(id) {
  const sb = getSupabase();
  // 先删除该学生的所有作业记录
  await sb.from('homework_records').delete().eq('student_id', id);
  // 再删除学生
  const { error } = await sb.from('students').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 批量删除科目（管理员用）
// ============================================================

async function deleteManySubjects(ids) {
  const sb = getSupabase();
  const { error } = await sb.from('subjects').delete().in('id', ids);
  if (error) throw error;
}

// ============================================================
// 批量删除班级（管理员用）
// ============================================================

async function deleteManyClasses(ids) {
  // 逐个调用 deleteClassById 保持级联删除逻辑
  for (var i = 0; i < ids.length; i++) {
    await deleteClassById(ids[i]);
  }
}