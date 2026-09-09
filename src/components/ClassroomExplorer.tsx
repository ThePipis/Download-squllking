import React, { useState } from 'react';
import { SkoolCourse } from '../types.ts';
import { BookOpen, Video, Search, ExternalLink, ArrowRight, Layers } from 'lucide-react';

interface ClassroomExplorerProps {
  courses: SkoolCourse[];
  communityName?: string;
  onSelectCourse: (course: SkoolCourse) => void;
  isLoadingCourse: boolean;
}

export const ClassroomExplorer: React.FC<ClassroomExplorerProps> = ({
  courses,
  communityName,
  onSelectCourse,
  isLoadingCourse,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCourses = courses.filter((c) => {
    const q = searchTerm.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.desc && c.desc.toLowerCase().includes(q));
  });

  return (
    <div id="classroom-explorer" className="space-y-6">
      {/* Overview header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Classroom Detectado
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Cursos Disponibles en {communityName || 'la Comunidad'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Se detectaron {courses.length} cursos listos para explorar y extraer videos.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar cursos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Grid of Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((course) => (
          <div
            key={course.id}
            className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Cover image */}
              <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                {course.coverImage ? (
                  <img
                    src={course.coverImage}
                    alt={course.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-400">
                    <BookOpen className="w-10 h-10" />
                  </div>
                )}
                {course.numModules ? (
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-semibold rounded-full flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    {course.numModules} lecciones
                  </span>
                ) : null}
              </div>

              {/* Course details */}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {course.title}
                </h3>
                {course.desc && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{course.desc}</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 pt-0 flex items-center justify-between border-t border-slate-100 mt-2">
              {course.url ? (
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Skool
                </a>
              ) : (
                <span />
              )}
              <button
                onClick={() => onSelectCourse(course)}
                disabled={isLoadingCourse}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Extraer Videos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
          No se encontraron cursos que coincidan con &quot;{searchTerm}&quot;.
        </div>
      )}
    </div>
  );
};
