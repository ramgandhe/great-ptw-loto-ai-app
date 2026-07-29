import { DirectoryListScreen } from "@/components/organisation/directory-list-screen";
import { loadDepartmentDirectory } from "@/lib/organisation/offline";

export default function DepartmentsDirectoryScreen() {
  return <DirectoryListScreen title="Department directory" loader={loadDepartmentDirectory} />;
}
