import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'О платформе — BMBCourses',
  description: 'Как устроена бесплатная учебная платформа BMBCourses и что доступно студентам и преподавателям.',
};

const questions = [
  { title: 'Сколько стоит обучение?', answer: 'Курсы бесплатны. Программу курса можно посмотреть сразу в каталоге.' },
  { title: 'Когда нужен аккаунт?', answer: 'Зарегистрируйся и подтверди почту, чтобы записаться на курс, открыть уроки и сохранять прогресс.' },
  { title: 'Можно ли продолжить на другом устройстве?', answer: 'Да. Войди в тот же аккаунт и открой «Мои курсы». Запись, пройденные уроки и результаты квизов сохраняются.' },
  { title: 'Где посмотреть балл за квиз?', answer: 'Балл появляется после отправки ответов. История попыток и средний балл по лучшим результатам доступны в разделе «Результаты» личного кабинета.' },
];

export default function AboutPage() {
  return <div className="marketing-page about-page">
    <section className="about-intro" aria-labelledby="about-title">
      <div>
        <h1 id="about-title">О платформе</h1>
        <p>BMBCourses — учебный проект для самостоятельного обучения. Здесь можно бесплатно выбрать курс, освоить тему по урокам и проверить себя в квизах.</p>
        <Link className="button" href="/courses">Открыть каталог</Link>
      </div>
      <nav aria-label="На этой странице" className="about-contents">
        <h2>На этой странице</h2>
        <a href="#students">Обучение <span aria-hidden="true">↓</span></a>
        <a href="#authors">Публикация курсов <span aria-hidden="true">↓</span></a>
        <a href="#questions">Частые вопросы <span aria-hidden="true">↓</span></a>
      </nav>
    </section>

    <section id="students" className="about-topic" aria-labelledby="students-title">
      <h2 id="students-title">Для студентов</h2>
      <div>
        <p>В каталоге можно искать курсы по названию и отбирать их по теме и уровню. На карточке видны описание, автор и программа.</p>
        <p>Уроки открываются по порядку. В них могут быть текст, видео, файлы и квизы. Прогресс и результаты сохраняются в личном кабинете.</p>
        <Link className="marketing-link" href="/account">Личный кабинет <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <section id="authors" className="about-topic" aria-labelledby="authors-title">
      <h2 id="authors-title">Для преподавателей</h2>
      <div>
        <p>Подай заявку через личный кабинет. После одобрения можно собирать курсы из уроков, добавлять материалы и создавать квизы.</p>
        <p>Администратор проверяет курс перед публикацией в каталоге. Автор может видеть прогресс и результаты студентов своих курсов.</p>
        <Link className="marketing-link" href="/studio">В раздел для авторов <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <section id="questions" className="about-topic" aria-labelledby="questions-title">
      <h2 id="questions-title">Частые вопросы</h2>
      <div className="about-faq">
        {questions.map(({ title, answer }) => <details key={title}>
          <summary>{title}</summary>
          <p>{answer}</p>
        </details>)}
      </div>
    </section>
  </div>;
}
