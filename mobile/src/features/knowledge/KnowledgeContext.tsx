import { createContext, useContext, useState, type ReactNode } from 'react';

import { KNOWLEDGE_ARTICLES } from './knowledgeData';

type KnowledgeContextValue = {
  articles: typeof KNOWLEDGE_ARTICLES;
  savedIds: string[];
  savedCount: number;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
};

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

const INITIAL_SAVED: string[] = [];

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>(INITIAL_SAVED);

  const toggleSaved = (id: string) => {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const value: KnowledgeContextValue = {
    articles: KNOWLEDGE_ARTICLES,
    savedIds,
    savedCount: savedIds.length,
    isSaved: (id) => savedIds.includes(id),
    toggleSaved,
  };

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) throw new Error('useKnowledge must be used inside KnowledgeProvider');
  return context;
}
