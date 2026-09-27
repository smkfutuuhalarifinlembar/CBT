import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add state for schoolProfile
if 'const [schoolProfile' not in content:
    content = content.replace(
        'const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => storage.getSubmissions());',
        'const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => storage.getSubmissions());\n  const [schoolProfile, setSchoolProfile] = useState(() => storage.getSchoolProfile());'
    )

# Add listener
if 'setSchoolProfile(storage.getSchoolProfile());' not in content:
    content = content.replace(
        'setSubmissions(storage.getSubmissions());',
        'setSubmissions(storage.getSubmissions());\n    setSchoolProfile(storage.getSchoolProfile());'
    )

content = content.replace(
    'window.addEventListener("edu_data_changed", onDataChanged);',
    'window.addEventListener("edu_data_changed", onDataChanged);\n    window.addEventListener("edu_school_changed", onDataChanged);'
)

content = content.replace(
    'window.removeEventListener("edu_data_changed", onDataChanged);',
    'window.removeEventListener("edu_data_changed", onDataChanged);\n      window.removeEventListener("edu_school_changed", onDataChanged);'
)

# Add handler for saving profile
if 'handleSaveSchoolProfile' not in content:
    content = content.replace(
        'const handleResetData = () => {',
        'const handleSaveSchoolProfile = (profile: any) => {\n    storage.saveSchoolProfile(profile);\n    setSchoolProfile(profile);\n  };\n\n  const handleResetData = () => {'
    )

# Pass to AdminDashboard
if 'schoolProfile=' not in content:
    content = content.replace(
        '<AdminDashboard',
        '<AdminDashboard\n            schoolProfile={schoolProfile}\n            onSaveSchoolProfile={handleSaveSchoolProfile}'
    )

# Pass to Login and Header
content = content.replace('<Login', '<Login schoolProfile={schoolProfile}')
content = content.replace('<Header', '<Header schoolProfile={schoolProfile}')

with open('src/App.tsx', 'w') as f:
    f.write(content)
