import React, { useState } from 'react';
import { FileResource } from '../../types';
import { MedhaApiService } from '../../services/api';
import { FolderOpen, FileText, Download, ExternalLink, Plus, Search, X } from 'lucide-react';

interface FilesViewProps {
  files: FileResource[];
  onRefresh: () => void;
}

export const FilesView: React.FC<FilesViewProps> = ({ files, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newFile, setNewFile] = useState<Partial<FileResource>>({
    name: '',
    category: 'Lecture Notes',
    size: '2.4 MB',
    url: 'https://drive.google.com/drive/folders/medha-files',
    type: 'pdf'
  });

  const filtered = files.filter(f => {
    const matchesCat = categoryFilter === 'All' || f.category === categoryFilter;
    const matchesSearch = !searchTerm || f.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile.name) return;

    MedhaApiService.addFile({
      name: newFile.name,
      category: newFile.category as any,
      size: newFile.size || '1.0 MB',
      url: newFile.url || '#',
      type: newFile.type as any
    });

    setIsAddOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents and resources..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] font-medium text-[#1e1b4b]"
          >
            <option value="All">All Categories</option>
            <option value="Curriculum">Curriculum</option>
            <option value="Lecture Notes">Lecture Notes</option>
            <option value="Recording Link">Recording Link</option>
            <option value="Agreement Template">Agreement Template</option>
            <option value="Form">Form</option>
          </select>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 bg-[#5b21b6] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add File / Link</span>
          </button>
        </div>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((file) => (
          <div
            key={file.id}
            className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs hover:border-purple-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2.5 rounded-xl bg-purple-50 text-[#5b21b6] font-bold">
                  <FileText className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f7f6fb] text-[#64748b]">
                  {file.category}
                </span>
              </div>

              <h4 className="font-bold text-xs text-[#1e1b4b] line-clamp-2 leading-relaxed">
                {file.name}
              </h4>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f7f6fb] flex items-center justify-between text-[11px] text-[#64748b]">
              <span>{file.size} · {file.updatedAt}</span>

              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#ede9fe] text-[#5b21b6] hover:bg-[#ddd6fe] font-bold flex items-center gap-1 transition-colors"
              >
                <span>{file.type === 'link' ? 'Open' : 'Download'}</span>
                {file.type === 'link' ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Add File Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#ece9f4] flex items-center justify-between bg-[#fafafa]">
              <h3 className="font-bold text-sm text-[#1e1b4b]">Add Resource or Drive Link</h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-lg text-[#64748b]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Resource Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Session_06_System_Design.pdf"
                  value={newFile.name}
                  onChange={(e) => setNewFile({ ...newFile, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={newFile.category}
                    onChange={(e) => setNewFile({ ...newFile, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] bg-white"
                  >
                    <option value="Curriculum">Curriculum</option>
                    <option value="Lecture Notes">Lecture Notes</option>
                    <option value="Recording Link">Recording Link</option>
                    <option value="Agreement Template">Agreement Template</option>
                    <option value="Form">Form</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Size / Type</label>
                  <input
                    type="text"
                    value={newFile.size}
                    onChange={(e) => setNewFile({ ...newFile, size: e.target.value })}
                    placeholder="e.g. 5.2 MB or Cloud Drive"
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">URL / Link Target</label>
                <input
                  type="url"
                  required
                  value={newFile.url}
                  onChange={(e) => setNewFile({ ...newFile, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f7f6fb] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-xs"
                >
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
