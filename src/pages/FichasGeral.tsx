import { FichasOverview } from "@/components/FichasOverview";
import { PageLayout } from "@/components/PageLayout";

const FichasGeral = () => {
  return (
    <PageLayout fullHeight>
      <div className="flex-1 overflow-hidden">
        <FichasOverview />
      </div>
    </PageLayout>
  );
};

export default FichasGeral;
