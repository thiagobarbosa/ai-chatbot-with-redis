import { Message } from 'ai'

export type User = {
  id: string;
  email: string;
  password: string;
};

export type Chat = {
  id: string;
  createdAt: Date;
  messages: Message[];
  userId: string;
};

export type Document = {
  id: string;
  createdAt: Date;
  title: string;
  content: string;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description?: string;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};
