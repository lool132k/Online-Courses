import type { ProgramLesson } from './catalog';

export type Material = { name: string; path: string; size: number };
export type QuizQuestion = { prompt: string; options: string[]; weight: number; correct: number[] };
export type DraftLesson = { title: string; section: string; body: string; video: string; materials: Material[]; quiz: QuizQuestion[] };
export type CourseDraft = { title: string; description: string; category: string; level: string; lessons: DraftLesson[] };
export type Enrollment = { id: string; title: string; active: boolean; status: string; completed: number; total: number; completedAt: string | null };
export type LearningCourse = { title: string; program: ProgramLesson[]; completed: number; readOnly: boolean };
export type Answers = Record<string, number[]>;
export const quizStatusLabels = {
  active: 'В процессе',
  pass: 'Пройден',
  fail: 'Не пройден',
  expired: 'Время истекло',
  abandoned: 'Прерван',
  cancelled_system: 'Отменён системой',
};
type QuizStatus = keyof typeof quizStatusLabels;
export type Attempt = { id: string; status: QuizStatus; deadline: string; score: number | null; answers: Answers; version: number; finishedAt: string | null };
export type StudentResults = {
  completedCourses: number;
  passedQuizzes: number;
  averageScore: number | null;
  page: number;
  pages: number;
  attempts: {
    id: string;
    courseTitle: string;
    lessonTitle: string;
    status: QuizStatus;
    score: number | null;
    bestScore: number | null;
    startedAt: string;
    durationSeconds: number | null;
  }[];
};
export type LearningLesson = Omit<DraftLesson, 'quiz'> & {
  questions: Omit<QuizQuestion, 'correct'>[];
  completed: boolean;
  readOnly: boolean;
  passed: boolean;
  attempts: Attempt[];
};
export type StudioCourse = { id: string; status: string; draft: CourseDraft; editedAt: string; reason: string | null; owned: boolean; admin: boolean };
export type StudioList = {
  teacher: boolean;
  admin: boolean;
  courses: { id: string; status: string; owned: boolean; title: string }[];
  requests: { id: string; name: string }[];
};

export function progressPercent(completed: number, total: number) {
  return completed === total ? 100 : Math.min(99, Math.round(100 * completed / total));
}

export function parseVideo(value: string): string | null {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const youtube = url.hostname === 'youtu.be' ? url.pathname.slice(1)
      : ['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname === '/watch' ? url.searchParams.get('v') : null;
    if (youtube && /^[\w-]{11}$/.test(youtube)) return `youtube:${youtube}`;
    const vimeo = ['vimeo.com', 'www.vimeo.com'].includes(url.hostname) && /^\/[0-9]{1,18}$/.test(url.pathname);
    return vimeo ? `vimeo:${url.pathname.slice(1)}` : null;
  } catch {
    return null;
  }
}

export function videoLink(video: string, embed = false) {
  if (/^youtube:[A-Za-z0-9_-]{11}$/.test(video)) {
    return embed ? `https://www.youtube-nocookie.com/embed/${video.slice(8)}` : `https://www.youtube.com/watch?v=${video.slice(8)}`;
  }
  if (/^vimeo:[0-9]{1,18}$/.test(video)) {
    return embed ? `https://player.vimeo.com/video/${video.slice(6)}` : `https://vimeo.com/${video.slice(6)}`;
  }
  return '';
}
