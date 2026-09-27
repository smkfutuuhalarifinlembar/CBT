with open('src/components/admin/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Replace types
content = content.replace('import { User, ClassRoom, Exam, ExamSubmission, UserRole, SchoolProfile } from "../../types";', 'import { User, ClassRoom, Exam, ExamSubmission, UserRole } from "../../types";')
content = content.replace('import { User, ClassRoom, Exam, ExamSubmission, UserRole } from "../../types";', 'import { User, ClassRoom, Exam, ExamSubmission, UserRole, SchoolProfile } from "../../types";')

# Add missing lucide-react Activity
if 'Activity' not in content.split('from "lucide-react"')[0]:
    content = content.replace('AlertTriangle', 'AlertTriangle, Activity')

# Make sure imports are present at top
if 'LiveExamTab' not in content:
    content = content.replace('export function AdminDashboard', 'import { LiveExamTab } from "./LiveExamTab";\nimport { SchoolSettingsTab } from "./SchoolSettingsTab";\n\nexport function AdminDashboard')

with open('src/components/admin/AdminDashboard.tsx', 'w') as f:
    f.write(content)
