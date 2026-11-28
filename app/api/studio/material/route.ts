import { type NextRequest, NextResponse } from 'next/server';
import { courseError, courseReply, courseSession, privateHeaders, validCourseId, validCourseOrigin } from '../../../../lib/course-api';
import type { CourseDraft } from '../../../../lib/learning-types';

const maxFileSize = 20 * 1024 * 1024;
const formats: Record<string, { mime: string; check: (bytes: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', check: data => data.subarray(0, 5).toString() === '%PDF-' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', check: data => zip(data) && data.includes('word/document.xml') },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', check: data => zip(data) && data.includes('ppt/presentation.xml') },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', check: data => zip(data) && data.includes('xl/workbook.xml') },
  txt: { mime: 'text/plain', check: data => !data.includes(0) && Boolean(new TextDecoder('utf-8', { fatal: true }).decode(data)) },
  png: { mime: 'image/png', check: data => data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  jpeg: { mime: 'image/jpeg', check: jpeg },
  jpg: { mime: 'image/jpeg', check: jpeg },
  webp: { mime: 'image/webp', check: data => data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' },
  zip: { mime: 'application/zip', check: zip },
};

function jpeg(data: Buffer) { return data.subarray(0, 3).toString('hex') === 'ffd8ff'; }
function zip(data: Buffer) { return ['504b0304', '504b0506'].includes(data.subarray(0, 4).toString('hex')); }

export async function GET(request: NextRequest) {
  const course = request.nextUrl.searchParams.get('course');
  const path = request.nextUrl.searchParams.get('path');
  if (!validCourseId(course) || !path || path.length > 100) return courseError('invalid');
  try {
    const session = await courseSession();
    if (!session) return courseError('unauthorized');
    const { data, error } = await session.client.rpc('course_studio', { p_action: 'get', p_course: course });
    if (error) throw error;
    if (data?.error) return courseError(data.error);
    const material = (data.draft as CourseDraft).lessons.flatMap(lesson => lesson.materials).find(item => item.path === path);
    if (!material) return courseError('missing');
    const signed = await session.client.storage.from('course-materials').createSignedUrl(material.path, 300, { download: material.name });
    if (signed.error) throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl, { headers: privateHeaders });
  } catch {
    return courseError('service');
  }
}

export async function POST(request: NextRequest) {
  if (!validCourseOrigin(request)) return courseError('forbidden');
  if (Number(request.headers.get('content-length')) > maxFileSize + 65536) {
    return courseReply({ message: 'Файл должен быть не больше 20 МБ.' }, 413);
  }
  try {
    const session = await courseSession();
    if (!session) return courseError('unauthorized');
    const { data: profile, error: profileError } = await session.client.from('profiles').select('is_teacher').eq('id', session.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_teacher) return courseError('forbidden');
    let data: FormData;
    try { data = await request.formData(); } catch { return courseError('invalid'); }
    const file = data.get('file');
    if (!(file instanceof File) || data.getAll('file').length !== 1) return courseError('invalid');
    if (!file.size || file.size > maxFileSize) return courseReply({ message: 'Размер файла должен быть от 1 байта до 20 МБ.' }, 413);
    const name = file.name.normalize('NFC').replace(/[\x00-\x1F\x7F/\\]/g, '_');
    const extension = name.split('.').at(-1)?.toLowerCase() ?? '';
    const format = Object.hasOwn(formats, extension) ? formats[extension] : null;
    if (!format || !name.includes('.') || name.length > 180) return courseReply({ message: 'Неподдерживаемый формат или слишком длинное имя файла.' }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    let valid = false;
    try { valid = format.check(bytes); } catch { /* Invalid encoding. */ }
    if (!valid || (file.type && file.type !== format.mime && file.type !== 'application/octet-stream'
      && !(extension === 'zip' && file.type === 'application/x-zip-compressed'))) {
      return courseReply({ message: 'Содержимое файла не соответствует расширению.' }, 400);
    }
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await session.client.storage.from('course-materials').upload(path, bytes, { contentType: format.mime });
    if (error) throw error;
    return courseReply({ name, path, size: file.size }, 201);
  } catch {
    return courseError('service');
  }
}
