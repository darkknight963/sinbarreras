## ADDED Requirements

### Requirement: Guided Project Creation Modal

The dashboard SHALL provide a guided single-step modal for creating a new project.

#### Scenario: Creating a project with contextual guidance

- **WHEN** the user clicks "Nuevo Proyecto"
- **THEN** the dashboard opens a modal with fields for project name, primary domain, entity type, and traffic value Vo
- **AND** the modal displays contextual guidance explaining that entity type defines the institutional context
- **AND** the modal displays contextual guidance explaining that traffic value Vo contributes to Peruvian prioritization
- **AND** the project creation payload preserves the existing name, domain, entityType, and vo fields

#### Scenario: Closing the project creation modal accessibly

- **WHEN** the modal is open
- **THEN** the close control is exposed as a button with an accessible name
- **AND** keyboard focus styles remain visible for the close control, submit button, and form controls

### Requirement: Dark Text Contrast on Light Dashboard Surfaces

The dashboard SHALL render dark, readable text by default inside light surfaces.

#### Scenario: Viewing project cards on a light background

- **WHEN** the projects overview displays project cards
- **THEN** entity labels such as "Administracion Publica Peruana" use dark readable text on the light card surface
- **AND** priority labels such as "Prioridad Media" use dark readable text on their semantic light backgrounds

#### Scenario: Viewing forms and report panels on light backgrounds

- **WHEN** the dashboard displays modals, panels, tables, form inputs, selects, badges, or chips on white or light backgrounds
- **THEN** those elements do not inherit light text colors intended for dark report surfaces
- **AND** labels, selected option text, helper text, and inline badges remain legible
