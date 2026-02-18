import React from 'react';
import './ProjectSelector.css';

function ProjectSelector({ projects, selectedProject, onSelectProject }) {
  return (
    <div className="project-selector">
      <select
        value={selectedProject?.id || ''}
        onChange={(e) => {
          const project = projects.find(p => p.id === e.target.value);
          onSelectProject(project);
        }}
        className="project-select"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProjectSelector;
