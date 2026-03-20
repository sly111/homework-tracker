// ============================================================
// 全局配置文件 - 根据需要修改此文件
// ============================================================

const CONFIG = {
  // Supabase 配置（必填，部署前请替换为您的实际值）
  supabaseUrl: 'https://bqrovbupinynkdhjvvnu.supabase.co ',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcm92YnVwaW55bmtkaGp2dm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTkwOTMsImV4cCI6MjA4OTUzNTA5M30.qkXiW5rORjQZOXfdIC3J9iiDQJtFSf9jm_t79xA3OoE',

  // 班级配置
  classes: 14,               // 班级总数
  defaultStudentCount: 50,   // 默认每班人数

  // 作业状态定义（顺序即循环切换顺序）
  statuses: [
    { name: '未交', color: '#999999', bgColor: '#f0f0f0', icon: '',  textColor: '#666666' },
    { name: '已交', color: '#ffffff', bgColor: '#4caf50', icon: '✓', textColor: '#ffffff' },
    { name: '优秀', color: '#ffffff', bgColor: '#e91e8c', icon: '★', textColor: '#ffffff' },
  ],

  // 科目列表（可扩展，顺序即显示顺序）
  subjects: [
    { name: '语文', icon: '📖', color: '#e91e8c' },
    { name: '数学', icon: '📐', color: '#2196f3' },
    { name: '英语', icon: '🔤', color: '#4caf50' },
    { name: '科学', icon: '🔬', color: '#ff9800' },
  ],

  // 应用标题
  appTitle: '作业打卡记录',

  // 每行显示的学生组数（学号+状态 为一组）
  columnsPerRow: 5,

  // localStorage key 前缀
  storageKeys: {
    visibleClasses: 'hw_visible_classes',   // 班级筛选可见性
    visibleSubjects: 'hw_visible_subjects', // 科目筛选可见性
    viewMode: 'hw_view_mode',               // 学号/姓名视图模式
    currentSubject: 'hw_current_subject',   // 当前科目
  },
};