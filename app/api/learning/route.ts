import type { NextRequest } from 'next/server';
import { runCourseRequest } from '../../../lib/course-api';

export function GET(request: NextRequest) {
  return runCourseRequest(request, 'learning_action', ['mine', 'course', 'lesson']);
}

export function POST(request: NextRequest) {
  return runCourseRequest(request, 'learning_action', [
    'enroll', 'leave', 'complete', 'start_quiz', 'save_quiz', 'submit_quiz', 'abandon_quiz',
  ]);
}
