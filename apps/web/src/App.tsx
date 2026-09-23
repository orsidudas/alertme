import { FormEvent, useEffect, useState } from 'react';

type User = { id: number; email: string; role: 'USER' | 'ADMIN' };
type Category = { id: number; name: string; slug: string };
type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string;
  categoryId: number;
  categoryName: string;
};
type Alert = { id: number; categoryId: number; categoryName: string; categorySlug: string; enabled: number; createdAt: string };
type Route = 'home' | 'alerts' | 'news' | 'categories' | 'users';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body as T;
}

function currentRoute(): Route {
  const path = window.location.hash.replace('#/', '');
  return path === 'alerts' || path === 'news' || path === 'categories' || path === 'users' ? path : 'home';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<Route>(currentRoute);
  const [categories, setCategories] = useState<Category[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [adminNews, setAdminNews] = useState<NewsItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [message, setMessage] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoryId: '', title: '', summary: '', content: '', sourceName: '', sourceUrl: '' });

  function navigate(nextRoute: Route) {
    window.location.hash = nextRoute === 'home' ? '/' : `/${nextRoute}`;
    setRoute(nextRoute);
    setMessage('');
  }

  async function loadNews() {
    const [categoryResponse, newsResponse] = await Promise.all([
      request<{ categories: Category[] }>('/api/categories'),
      request<{ news: NewsItem[] }>('/api/news')
    ]);
    setCategories(categoryResponse.categories);
    setNews(newsResponse.news);
  }

  async function loadAdminNews() {
    const response = await request<{ news: NewsItem[] }>('/api/admin/news');
    setAdminNews(response.news);
  }

  async function loadAdminUsers() {
    const response = await request<{ users: User[] }>('/api/admin/users');
    setAdminUsers(response.users);
  }

  async function loadAlerts() {
    const response = await request<{ alerts: Alert[] }>('/api/alerts');
    setAlerts(response.alerts);
  }

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(currentRoute());
      setMessage('');
    };
    window.addEventListener('hashchange', handleHashChange);
    loadNews().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load news'));
    request<{ user: User }>('/api/auth/me').then((response) => setUser(response.user)).catch(() => undefined);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadAdminNews().catch(() => undefined);
      loadAdminUsers().catch(() => undefined);
    }
    if (user) loadAlerts().catch(() => undefined);
  }, [user]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await request<{ user: User }>('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      setUser(response.user);
      setPassword('');
      setMessage('Signed in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in');
    }
  }

  async function handleSignup(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await request<{ user: User }>('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      setUser(response.user);
      setPassword('');
      setMessage('Account created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account');
    }
  }

  async function handleLogout() {
    await request('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('home');
  }

  async function handleSaveNews(event: FormEvent) {
    event.preventDefault();
    try {
      await request(editingNewsId ? `/api/admin/news/${editingNewsId}` : '/api/admin/news', {
        method: editingNewsId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, categoryId: Number(form.categoryId) })
      });
      setForm({ categoryId: '', title: '', summary: '', content: '', sourceName: '', sourceUrl: '' });
      setEditingNewsId(null);
      setMessage(editingNewsId ? 'News updated.' : 'News published.');
      await loadNews();
      await loadAdminNews();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save news');
    }
  }

  function editNews(item: NewsItem) {
    setEditingNewsId(item.id);
    setForm({ categoryId: String(item.categoryId), title: item.title, summary: item.summary, content: item.content, sourceName: item.sourceName ?? '', sourceUrl: item.sourceUrl ?? '' });
  }

  async function deleteNews(id: number) {
    if (!window.confirm('Delete this news item?')) return;
    try {
      await request(`/api/admin/news/${id}`, { method: 'DELETE' });
      setMessage('News deleted.');
      await loadNews();
      await loadAdminNews();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete news');
    }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    try {
      await request(editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : '/api/admin/categories', {
        method: editingCategoryId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName })
      });
      setCategoryName('');
      setEditingCategoryId(null);
      setMessage('Category saved.');
      await loadNews();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save category');
    }
  }

  async function deleteCategory(id: number) {
    if (!window.confirm('Delete this category?')) return;
    try {
      await request(`/api/admin/categories/${id}`, { method: 'DELETE' });
      setMessage('Category deleted.');
      await loadNews();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete category');
    }
  }

  async function updateUserRole(id: number, role: User['role']) {
    try {
      await request(`/api/admin/users/${id}/role`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
      });
      setMessage('User role updated.');
      await loadAdminUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update user role');
    }
  }

  async function createAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    try {
      await request('/api/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: Number(formData.get('categoryId')) })
      });
      formElement.reset();
      setMessage('Alert created.');
      await loadAlerts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create alert');
    }
  }

  async function toggleAlert(alert: Alert) {
    try {
      await request(`/api/alerts/${alert.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !alert.enabled })
      });
      await loadAlerts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update alert');
    }
  }

  async function deleteAlert(id: number) {
    if (!window.confirm('Delete this alert?')) return;
    try {
      await request(`/api/alerts/${id}`, { method: 'DELETE' });
      setMessage('Alert deleted.');
      await loadAlerts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete alert');
    }
  }

  function renderNews() {
    return <section className="news-column">
      <div className="section-heading"><span>Latest stories</span><span>{news.length} items</span></div>
      {news.length === 0 ? <p className="empty">No news has been published yet.</p> : news.map((item) => <article className="story" key={item.id}>
        <div className="story-meta"><span>{item.categoryName}</span><span>{new Date(item.publishedAt).toLocaleDateString()}</span></div>
        <h2>{item.title}</h2><p className="summary">{item.summary}</p><p>{item.content}</p>
        {item.sourceUrl && item.sourceName ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source: {item.sourceName}</a> : null}
      </article>)}
    </section>;
  }

  function renderNewsManagement() {
    return <section className="management-page">
      <div className="section-heading"><span>Manage news</span><span>{adminNews.length} items</span></div>
      <form className="panel management-form" onSubmit={handleSaveNews}>
        <p className="eyebrow">Admin workspace</p><h2>{editingNewsId ? 'Edit story' : 'Publish a story'}</h2>
        <label>Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Choose one</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Headline<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Summary<textarea rows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} required /></label>
        <label>Story<textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label>
        <label>Source name <span className="optional">(optional)</span><input value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} /></label>
        <label>Source URL <span className="optional">(optional)</span><input type="url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} /></label>
        <button type="submit">{editingNewsId ? 'Save changes' : 'Publish story'}</button>
        {editingNewsId ? <button type="button" className="quiet-button" onClick={() => { setEditingNewsId(null); setForm({ categoryId: '', title: '', summary: '', content: '', sourceName: '', sourceUrl: '' }); }}>Cancel edit</button> : null}
      </form>
      <div className="panel admin-list"><h2>Published news</h2>{adminNews.map((item) => <div className="admin-row" key={item.id}><span>{item.title}</span><span><button type="button" onClick={() => editNews(item)}>Edit</button><button type="button" className="danger-button" onClick={() => deleteNews(item.id)}>Delete</button></span></div>)}</div>
    </section>;
  }

  function renderCategoryManagement() {
    return <section className="management-page">
      <div className="section-heading"><span>Manage category</span><span>{categories.length} categories</span></div>
      <form className="panel management-form" onSubmit={saveCategory}><h2>{editingCategoryId ? 'Edit category' : 'Add category'}</h2><label>Name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required /></label><button type="submit">{editingCategoryId ? 'Save category' : 'Add category'}</button>{editingCategoryId ? <button type="button" className="quiet-button" onClick={() => { setEditingCategoryId(null); setCategoryName(''); }}>Cancel</button> : null}</form>
      <div className="panel admin-list"><h2>Categories</h2>{categories.map((category) => <div className="admin-row" key={category.id}><span>{category.name}</span><span><button type="button" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}>Edit</button><button type="button" className="danger-button" onClick={() => deleteCategory(category.id)}>Delete</button></span></div>)}</div>
    </section>;
  }

  function renderUserManagement() {
    return <section className="management-page">
      <div className="section-heading"><span>Manage Users</span><span>{adminUsers.length} users</span></div>
      <div className="panel admin-list"><h2>Users</h2>{adminUsers.map((managedUser) => <div className="admin-row" key={managedUser.id}><span><strong>{managedUser.email}</strong><small>{managedUser.role}</small></span><select value={managedUser.role} onChange={(event) => updateUserRole(managedUser.id, event.target.value as User['role'])}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></div>)}</div>
    </section>;
  }

  function renderAlerts() {
    return <section className="management-page">
      <div className="section-heading"><span>My alerts</span><span>{alerts.length} alerts</span></div>
      <form className="panel management-form" onSubmit={createAlert}>
        <p className="eyebrow">Category alert</p><h2>Create an alert</h2>
        <label>Category<select name="categoryId" defaultValue="" required><option value="">Choose one</option>{categories.map((category) => { const alreadyAlerted = alerts.some((alert) => alert.categoryId === category.id); return <option key={category.id} value={category.id} disabled={alreadyAlerted}>{category.name}{alreadyAlerted ? ' (already added)' : ''}</option>; })}</select></label>
        <button type="submit">Create alert</button>
      </form>
      <div className="panel admin-list"><h2>Your alerts</h2>{alerts.length === 0 ? <p className="empty">You have not created any alerts yet.</p> : alerts.map((alert) => <div className="admin-row" key={alert.id}><span><strong>{alert.categoryName}</strong><small>{alert.enabled ? 'Enabled' : 'Disabled'}</small></span><span><button type="button" onClick={() => toggleAlert(alert)}>{alert.enabled ? 'Disable' : 'Enable'}</button><button type="button" className="danger-button" onClick={() => deleteAlert(alert.id)}>Delete</button></span></div>)}</div>
    </section>;
  }

  const isAdmin = user?.role === 'ADMIN';
  const page = route === 'alerts' && user ? renderAlerts() : route === 'news' && isAdmin ? renderNewsManagement() : route === 'categories' && isAdmin ? renderCategoryManagement() : route === 'users' && isAdmin ? renderUserManagement() : renderNews();

  return <main>
    <header className="topbar"><div><p className="eyebrow">Alertme / News desk</p><h1>What is happening now.</h1></div>{user ? <button className="quiet-button" onClick={handleLogout}>Sign out</button> : null}</header>
    {user ? <nav className="top-menu" aria-label="User menu"><button className={route === 'home' ? 'active' : ''} onClick={() => navigate('home')}>Home</button><button className={route === 'alerts' ? 'active' : ''} onClick={() => navigate('alerts')}>Alerts</button>{isAdmin ? <><button className={route === 'news' ? 'active' : ''} onClick={() => navigate('news')}>Manage news</button><button className={route === 'categories' ? 'active' : ''} onClick={() => navigate('categories')}>Manage category</button><button className={route === 'users' ? 'active' : ''} onClick={() => navigate('users')}>Manage Users</button></> : null}</nav> : null}
    {!user ? <div className="layout"><>{page}</><aside className="side-column"><form className="panel" onSubmit={authMode === 'login' ? handleLogin : handleSignup}><h2>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button type="submit">{authMode === 'login' ? 'Sign in' : 'Sign up'}</button><button type="button" className="quiet-button auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{authMode === 'login' ? 'Need an account? Sign up' : 'Already registered? Sign in'}</button><p className="hint">New accounts start with the USER role.</p></form>{message ? <p className="message" aria-live="polite">{message}</p> : null}</aside></div> : <div className="layout">{page}<aside className="side-column">{route === 'home' ? <div className="panel"><p className="eyebrow">Signed in</p><h2>{user.email}</h2><p className="hint">Use the admin menu to manage the newsroom.</p></div> : null}{message ? <p className="message" aria-live="polite">{message}</p> : null}</aside></div>}
  </main>;
}

export default App;
