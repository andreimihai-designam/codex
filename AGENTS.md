# Master Codex — AGENTS.md

Version: 1.0
Last updated: 2026-11-02
Status: Core rules approved; additional rules may be added later.

## Purpose
This document defines reusable collaboration and development rules for Codex projects. Apply it to each new website, web application, or mobile application project, together with that project's specific requirements. If project-specific requirements conflict with these rules, flag the conflict and ask for a decision before proceeding.

## Scope
- Build websites, web applications, and mobile applications according to each project's brief.
- Select the technology stack separately for each project. Explain the options and recommend the best fit based on requirements, maintainability, cost, performance, and deployment.
- Proactively suggest useful settings, features, improvements, and product ideas; distinguish required features from optional recommendations.
- Prepare a clear initial project prompt/brief that the user and assistant can revise together before implementation.
- Ask targeted questions about material ambiguities before implementation. Do not guess critical requirements.

## Mandatory approval gate
**Do not start implementing application code until the user explicitly approves the project plan and its feature scope.**
Before approval, work may include discovery, questions, architecture proposals, design direction, risk assessment, implementation plan, and draft prompts. Approval of an idea or discussion is not approval to code. If scope changes materially, present the change for approval before implementing it.

## Standard project workflow
1. **Project brief:** Clarify purpose, target users, platforms, main workflows, and success criteria.
2. **Clarification:** Ask only questions that materially affect design or implementation.
3. **Product proposal:** Separate must-have features, optional features, recommended settings, and future enhancements.
4. **Technical proposal:** Compare suitable stacks and recommend one for this project; specify architecture, data/storage, authentication, integrations, hosting, security, and cost implications where relevant.
5. **UX/UI plan:** Outline screens, navigation, responsive behavior, accessibility, and visual direction.
6. **Delivery plan:** Define MVP, milestones, acceptance criteria, tests, and launch/deployment approach.
7. **Approval:** Request explicit user confirmation of plan and features. **Stop here until approved.**
8. **Implementation:** Build in manageable increments, explaining meaningful decisions and preserving approved requirements.
9. **Quality assurance:** Test functionality, responsiveness, accessibility, error handling, security basics, and performance as applicable. Clearly report what was actually tested versus not tested.
10. **Handoff:** Supply setup/run instructions, configuration requirements, deployment steps, known limitations, and next-step suggestions.

## Working principles
- Prioritize accurate, practical, maintainable, production-quality solutions.
- Do not invent credentials, APIs, data, project constraints, or completed tests.
- Protect secrets and personal data; never hardcode credentials.
- Use sensible defaults only when noncritical and state them explicitly.
- Keep scope changes visible and obtain approval for material changes.
- Prefer an MVP before advanced features unless the approved plan says otherwise.
- Treat UI/UX quality, responsive design, accessibility, performance, and security as design considerations from the start.
- Document decisions so work can continue across sessions without relying solely on chat memory.

## Project-specific documentation
For each project, maintain a project brief and decision log (for example, `PROJECT_BRIEF.md` and `DECISIONS.md`). Project-specific instructions may be placed in a local `AGENTS.md` and should supplement, not silently override, these master rules.

## Daily Development Outlook
A separate daily ideation/reporting workflow proposes new app and website ideas, useful features, and opportunities. It is not an instruction to Codex to autonomously create projects or implement code. Ideas remain proposals until the user chooses a project and approves its plan.

## Change control
- Update the version and date when these rules change.
- Record newly approved rules; do not treat unapproved suggestions as mandatory.
- If a rule is unclear, ask before applying it to a consequential implementation decision.
