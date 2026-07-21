export interface SessionTodo {
  _id: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

export interface SessionNote {
  _id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSession {
  _id: string;
  userId: string;
  title: string;
  todos: SessionTodo[];
  notes: SessionNote[];
  createdAt: string;
  updatedAt: string;
}
