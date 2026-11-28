import type { NextRequest } from 'next/server';
import { runCourseRequest } from '../../../lib/course-api';

export function GET(request: NextRequest) {
  return runCourseRequest(request, 'course_studio', ['list', 'get', 'stats']);
}

export function POST(request: NextRequest) {
  return runCourseRequest(request, 'course_studio', [
    'create', 'save', 'submit', 'withdraw', 'publish', 'reject',
    'unpublish', 'archive', 'restore', 'approve_teacher', 'reject_teacher',
  ]);
}
