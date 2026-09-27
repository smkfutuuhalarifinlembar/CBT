with open('src/components/admin/AdminDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace('import { User, Exam, ExamSubmission, ClassRoom, UserRole } from "../../types";', 'import { User, Exam, ExamSubmission, ClassRoom, UserRole, SchoolProfile } from "../../types";\nimport { LiveExamTab } from "./LiveExamTab";\nimport { SchoolSettingsTab } from "./SchoolSettingsTab";')

with open('src/components/admin/AdminDashboard.tsx', 'w') as f:
    f.write(content)
