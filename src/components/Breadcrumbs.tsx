import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types';

export interface BreadcrumbCrumb {
  name: string;
  route?: AppRoute;
}

interface BreadcrumbsProps {
  items: BreadcrumbCrumb[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  const { setRoute } = useApp();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-6 flex-wrap gap-1.5">
      <button
        onClick={() => setRoute('/')}
        className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-600 shrink-0" />
            {isLast || !item.route ? (
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                {item.name}
              </span>
            ) : (
              <button
                onClick={() => setRoute(item.route!)}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none truncate max-w-[180px]"
              >
                {item.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
