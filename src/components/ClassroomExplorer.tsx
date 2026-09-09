import React, { useState } from 'react';
import { SkoolCourse } from '../types.ts';
import {
  BookOpen,
  Video,
  Search,
  ExternalLink,
  ArrowRight,
  Layers,
  FolderArchive,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';

interface ClassroomExplorerProps {
  courses: SkoolCourse[];
  communityName?: string;
  onSelectCourse: (course: SkoolCourse) => void;
  isLoadingCourse: boolean;
  onDownloadCoursesZip?: (selectedCourses: SkoolCourse[]) => void;
  isDownloadingZip?: boolean;
}

export const ClassroomExplorer: React.FC<ClassroomExplorerProps> = ({
  courses,
  communityName,
  onSelectCourse,
  isLoadingCourse,
  onDownloadCoursesZip,
  isDownloadingZip = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());

  const filteredCourses = courses.filter((c) => {
    const q = searchTerm.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.desc && c.desc.toLowerCase().includes(q));
  });

  const allFilteredSelected =
    filteredCourses.length > 0 &&
    filteredCourses.every((c) => selectedCourseIds.has(c.id || c.name));

  const someSelected = selectedCourseIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedCourseIds(new Set());
    } else {
      const allIds = new Set(filteredCourses.map((c) => c.id || c.name));
      setSelectedCourseIds(allIds);
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleBatchDownloadClick = () => {
    if (!onDownloadCoursesZip) return;
    const targets = courses.filter((c) => selectedCourseIds.has(c.id || c.name));
    if (targets.length === 0) return;
    onDownloadCoursesZip(targets);
  };

  const handleDownloadAllClassroomClick = () => {
    if (!onDownloadCoursesZip) return;
    onDownloadCoursesZip(courses);
  };

  return (
    <div id="classroom-explorer" className="space-y-6">
      {/* Overview header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" /> Classroom Detectado
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Cursos Disponibles en {communityName || 'la Comunidad'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Se detectaron {courses.length} cursos. Selecciona los cursos que desees empaquetar o explóralos individualmente.
          </p>
        </div>

        {/* Controls: Search and Batch Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar curso por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <button
            onClick={handleDownloadAllClassroomClick}
            disabled={isDownloadingZip || courses.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
            title="Descarga todos los cursos y lecciones de esta comunidad organizados en un solo archivo ZIP"
          >
            <FolderArchive className="w-4 h-4 text-emerald-400" />
            <span className="whitespace-nowrap">Descargar Todo ({courses.length}) .ZIP</span>
          </button>
        </div>
      </div>

      {/* Batch Selection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 font-semibold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {allFilteredSelected ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : someSelected ? (
              <div className="w-4 h-4 rounded border-2 border-indigo-600 bg-indigo-600 flex items-center justify-center text-white">
                <div className="w-2 h-0.5 bg-white rounded-full" />
              </div>
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos los cursos'}
            </span>
          </button>

          <span className="text-slate-400">|</span>

          <span className="text-slate-600">
            <strong className="text-slate-900 font-bold">{selectedCourseIds.size}</strong> de{' '}
            {courses.length} cursos seleccionados
          </span>
        </div>

        {someSelected && (
          <div className="flex items-center gap-2 animate-in fade-in duration-150">
            <button
              onClick={handleBatchDownloadClick}
              disabled={isDownloadingZip}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>
                Descargar {selectedCourseIds.size}{' '}
                {selectedCourseIds.size === 1 ? 'Curso' : 'Cursos'} (.ZIP)
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Grid of Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((course, idx) => {
          const courseId = course.id || course.name;
          const isSelected = selectedCourseIds.has(courseId);

          return (
            <div
              key={courseId || idx}
              onClick={() => toggleCourse(courseId)}
              className={`group relative bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-100/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Cover image with Selection Checkbox overlay */}
                <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-400">
                      <BookOpen className="w-10 h-10" />
                    </div>
                  )}

                  {/* Gradient overlay for contrast */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/30 pointer-events-none" />

                  {/* Checkbox overlay top-left */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCourse(courseId);
                    }}
                    className={`absolute top-3 left-3 w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-md cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white scale-105'
                        : 'bg-white/90 backdrop-blur-xs text-slate-400 border border-slate-300/80 hover:bg-white hover:text-slate-600'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <div className="w-3 h-3 rounded-xs border border-slate-400/60" />
                    )}
                  </div>

                  {/* Module count badge */}
                  {course.numModules ? (
                    <span className="absolute top-3 right-3 px-2.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-semibold rounded-full flex items-center gap-1 shadow-xs">
                      <Video className="w-3 h-3" />
                      {course.numModules} lecciones
                    </span>
                  ) : null}
                </div>

                {/* Course details */}
                <div className="p-4 space-y-1.5">
                  <h3
                    className={`font-bold text-sm line-clamp-2 transition-colors ${
                      isSelected ? 'text-indigo-600' : 'text-slate-900 group-hover:text-indigo-600'
                    }`}
                  >
                    {course.title}
                  </h3>
                  {course.desc && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {course.desc}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 pt-2 flex items-center justify-between border-t border-slate-100 mt-2 gap-2">
                {course.url ? (
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Skool
                  </a>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCourse(course);
                    }}
                    disabled={isLoadingCourse}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Explorar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
          No se encontraron cursos que coincidan con &quot;{searchTerm}&quot;.
        </div>
      )}
    </div>
  );
};
