import { LoaderIcon } from "lucide-react";
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <LoaderIcon className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-cyan-400" />
    </div>
  );
}
export default PageLoader;
