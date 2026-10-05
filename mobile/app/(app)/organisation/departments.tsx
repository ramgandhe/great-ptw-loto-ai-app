import { RecordListScreen } from "@/components/record-list-screen";
import { loadDepartmentDirectory } from "@/lib/organisation/offline";

export default function DepartmentsDirectoryScreen() {
  return <RecordListScreen title="Departments" back={{ label: "Organisation", href: "/organisation" }} loader={loadDepartmentDirectory} details={(d) => [d.code, d.description]} />;
}
