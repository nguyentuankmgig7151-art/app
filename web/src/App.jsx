import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import HomePage from './pages/HomePage.jsx';
import PostDetailPage from './pages/PostDetailPage.jsx';
import PostEditorPage from './pages/PostEditorPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import UserProfilePage from './pages/UserProfilePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import TagsPage from './pages/TagsPage.jsx';
import TagPostsPage from './pages/TagPostsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function Layout() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}

// /me -> /users/:myId
function MeRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/users/${user.id}`} replace />;
}

const protectedPage = (node) => <ProtectedRoute>{node}</ProtectedRoute>;

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/posts/:id', element: <PostDetailPage /> },
      { path: '/new', element: protectedPage(<PostEditorPage />) },
      { path: '/posts/:id/edit', element: protectedPage(<PostEditorPage />) },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/users/:id', element: <UserProfilePage /> },
      { path: '/me', element: protectedPage(<MeRedirect />) },
      { path: '/search', element: <SearchPage /> },
      { path: '/tags', element: <TagsPage /> },
      { path: '/tags/:name', element: <TagPostsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
