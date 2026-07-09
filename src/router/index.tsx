import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { EditorArea } from '@/components/layout/EditorArea';

/** 应用路由组件 — 单一路由，编辑器区域始终展示 */
export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<EditorArea />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
