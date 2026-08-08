export type IssueStatus = 'pending' | 'in-progress' | 'resolved' | 'rejected';

export interface IssueReport {
  id: string;
  userId: string;
  name: string;
  email: string;
  description: string;
  /** Absolute URL, already resolved against the API's origin by IssueService. Null when no image was attached. */
  imageUrl: string | null;
  status: IssueStatus;
  createdAt: Date;
  updatedAt: Date;
}
