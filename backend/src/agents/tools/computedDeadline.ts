export interface IComputedDeadline {
  dueDateFormatted: string;
  daysRemaining: number;
  isOverdue: boolean;
}

export const computedDeadline = (dueDate: string): IComputedDeadline => {
  if (!dueDate || typeof dueDate !== 'string') {
    return { dueDateFormatted: 'N/A', daysRemaining: 0, isOverdue: false };
  }
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dueDateFormatted = due.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return { dueDateFormatted, daysRemaining, isOverdue: daysRemaining < 0 };
};
