// client/src/App.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

// --- Axios Interceptors ---
axios.interceptors.request.use((config) => {
  // GraphQLのリクエストを見やすくするためのログ調整
  if (config.url?.includes('graphql')) {
    console.log(`%c [GraphQL] QUERY`, 'color: purple; font-weight: bold;', config.data?.query);
  } else {
    console.log(`%c [REST] ${config.method?.toUpperCase()} ${config.url}`, 'color: blue; font-weight: bold;', config.data ? config.data : '' );
  }
  return config;
});
axios.interceptors.response.use(
  (response) => {
    console.log(`%c [RESPONSE] ${response.status}`, 'color: green; font-weight: bold;', response.data);
    return response;
  },
  (error) => {
    console.log(`%c [ERROR]`, 'color: red; font-weight: bold;', error.response?.data);
    return Promise.reject(error);
  }
);

// --- 型定義 ---
interface Tag {
  name: string;
}

// GraphQLで一括取得するため、TaskDetail一つで管理します
interface Task {
  id: number;
  title: string;
  due_date: string | null;
  description: string;
  location: string;
  status: string;
  // createdAt, updatedAt は取得しません（オーバーフェッチ解消）
  tags: Tag[]; // GraphQLでは小文字の tags フィールドとして定義しました
}

interface TaskInput {
  title: string;
  description: string;
  due_date: string;
  location: string;
  tagsStr: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');

  const initialFormState: TaskInput = { title: '', description: '', due_date: '', location: '', tagsStr: '' };
  const [newTask, setNewTask] = useState<TaskInput>(initialFormState);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskInput>(initialFormState);

  // スタイル定義
  const inputStyle = { display: 'block', width: '100%', marginBottom: '5px', padding: '8px', boxSizing: 'border-box' as const };
  const flexInputStyle = { padding: '8px', boxSizing: 'border-box' as const };

  // --- GraphQL Fetch (N+1解消版) ---
  const fetchTasksGraphQL = async () => {
    setLoading(true);
    // console.group('🔥 GraphQL Fetch'); 

    try {
      // GraphQL クエリの構築
      // 必要なフィールドだけを明示的に指定します (Over-fetching解消)
      const query = `
        query GetTasks($q: String, $tag: String) {
          tasks(q: $q, tag: $tag) {
            id
            title
            due_date
            description
            location
            status
            tags {
              name
            }
          }
        }
      `;

      // 変数
      const variables = {
        q: searchQuery || null,
        tag: searchTag || null
      };

      // POSTリクエスト (1回だけ！)
      const response = await axios.post('http://localhost:3010/graphql', {
        query,
        variables
      });

      // GraphQLのレスポンス形式: data.data.tasks
      const fetchedTasks = response.data.data.tasks;
      setTasks(fetchedTasks);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      // console.groupEnd();
    }
  };

  useEffect(() => {
    fetchTasksGraphQL();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseTags = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  // --- Actions (書き込みはREST APIを使用) ---
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!newTask.title) return alert("Title required");
    try {
      await axios.post('http://localhost:3010/tasks', { ...newTask, tags: parseTags(newTask.tagsStr) });
      setNewTask(initialFormState);
      fetchTasksGraphQL(); // 再取得はGraphQLで
    } catch (error) { console.error(error); }
  };

  const startEdit = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(task.id);
    const tagsStr = task.tags ? task.tags.map(t => t.name).join(', ') : '';
    setEditForm({ 
      title: task.title, 
      description: task.description || '', 
      due_date: task.due_date || '', 
      location: task.location || '', 
      tagsStr 
    });
  };

  const handleUpdate = async (id: number, currentStatus: string) => {
    try {
      await axios.put(`http://localhost:3010/tasks/${id}`, {
        title: editForm.title,
        description: editForm.description,
        due_date: editForm.due_date,
        location: editForm.location,
        status: currentStatus,
        tags: parseTags(editForm.tagsStr)
      });
      setEditingId(null);
      fetchTasksGraphQL(); // 再取得はGraphQLで
    } catch (error) { console.error(error); }
  };

  const toggleStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const tags = task.tags.map(t => t.name); // GraphQLのレスポンスに合わせて tags (小文字)
    try {
      // 既存REST APIは全データを期待するため、今のtaskデータをそのまま投げる
      // (REST側で不足データがあっても更新対象外ならOKな実装に依存)
      await axios.put(`http://localhost:3010/tasks/${task.id}`, {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        location: task.location,
        status: newStatus,
        tags: tags
      });
      fetchTasksGraphQL(); // 再取得はGraphQLで
    } catch (error) { console.error(error); }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete?")) return;
    try {
      await axios.delete(`http://localhost:3010/tasks/${id}`);
      fetchTasksGraphQL(); // 再取得はGraphQLで
    } catch (error) { console.error(error); }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Mono Task</h1>

      {/* 検索バー */}
      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" placeholder="Search keywords..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ ...flexInputStyle, flex: 1 }}
        />
        <input 
          type="text" placeholder="Filter by tag..." value={searchTag}
          onChange={e => setSearchTag(e.target.value)} style={{ ...flexInputStyle, flex: 1 }}
        />
        <button onClick={fetchTasksGraphQL} disabled={loading}>Search</button>
        {(searchQuery || searchTag) && <button onClick={() => { setSearchQuery(''); setSearchTag(''); }}>Clear</button>}
      </div>

      {/* 新規作成 (変更なし) */}
      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Create New Task</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
          <input 
            type="text" placeholder="Title" value={newTask.title}
            onChange={e => setNewTask({...newTask, title: e.target.value})}
            style={{ ...flexInputStyle, flex: 2 }}
          />
          <input 
            type="date" value={newTask.due_date}
            onChange={e => setNewTask({...newTask, due_date: e.target.value})}
            style={{ ...flexInputStyle, flex: 1 }}
          />
        </div>
        <input 
          type="text" placeholder="Location" value={newTask.location}
          onChange={e => setNewTask({...newTask, location: e.target.value})}
          style={inputStyle}
        />
        <input 
          type="text" placeholder="Tags" value={newTask.tagsStr}
          onChange={e => setNewTask({...newTask, tagsStr: e.target.value})}
          style={inputStyle}
        />
        <textarea 
          placeholder="Description" value={newTask.description}
          onChange={e => setNewTask({...newTask, description: e.target.value})}
          style={{ ...inputStyle, height: '60px' }}
        />
        <button onClick={handleCreate} disabled={loading}>Add Task</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Tasks List</h2>
      </div>
      <hr />

      <div style={{ marginTop: '20px' }}>
        {tasks.map((task) => {
          const isExpanded = expandedIds.includes(task.id);
          const isCompleted = task.status === 'completed';

          return (
            <div 
              key={task.id} 
              onClick={() => toggleExpand(task.id)}
              style={{ 
                border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '10px',
                backgroundColor: isCompleted ? '#e8f5e9' : 'white',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {editingId === task.id ? (
                // 編集モード
                <div onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
                  <input 
                    value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                    style={inputStyle} placeholder="Title"
                  />
                  <input 
                    type="date" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})}
                    style={inputStyle}
                  />
                  <input 
                    value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})}
                    style={inputStyle} placeholder="Location"
                  />
                   <input 
                    value={editForm.tagsStr} onChange={e => setEditForm({...editForm, tagsStr: e.target.value})}
                    style={inputStyle} placeholder="Tags"
                  />
                  <textarea 
                    value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                    style={inputStyle} placeholder="Description"
                  />
                  <button onClick={() => handleUpdate(task.id, task.status)}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ marginLeft: '5px' }}>Cancel</button>
                </div>
              ) : (
                // 表示モード
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <button 
                            onClick={(e) => toggleStatus(task, e)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: isCompleted ? '#4CAF50' : '#fff',
                              color: isCompleted ? 'white' : '#555',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
                            }}
                          >
                            {isCompleted ? '✓ Completed' : 'Mark Complete'}
                          </button>
                          
                          <h3 style={{ margin: 0, textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? '#888' : '#000' }}>
                            {task.title}
                          </h3>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: task.due_date ? '#d32f2f' : '#888', fontWeight: 'bold', marginTop: '5px', marginLeft: '5px' }}>
                        Due: {task.due_date ? task.due_date : 'No deadline'}
                      </div>
                    </div>
                    <div>
                      <button onClick={(e) => startEdit(task, e)}>Edit</button>
                      <button onClick={(e) => handleDelete(task.id, e)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                    </div>
                  </div>

                  <div style={{ marginTop: '8px', marginLeft: '5px' }}>
                    {/* GraphQLでは tags (小文字) で受け取る */}
                    {task.tags && task.tags.map(tag => (
                      <span key={tag.name} 
                        onClick={(e) => { e.stopPropagation(); setSearchTag(tag.name); }}
                        style={{ 
                          display: 'inline-block', backgroundColor: '#607D8B', color: 'white', 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', 
                          marginRight: '5px', cursor: 'pointer' 
                        }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd', animation: 'fadeIn 0.3s' }}>
                      <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#555' }}>
                        📍 {task.location || 'No location specified'}
                      </p>
                      <p style={{ whiteSpace: 'pre-wrap', color: '#333', margin: '0' }}>
                        {task.description || '(No description)'}
                      </p>
                      {/* createdAt/updatedAt はGraphQLで取得していないので表示しない */}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

export default App;