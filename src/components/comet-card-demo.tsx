import { CometCard } from "@/components/ui/comet-card";
import {
  PoktProfileCard,
  type PoktProfileCardProps,
} from "@/components/pokt-profile-card";

export function CometCardDemo(props: PoktProfileCardProps) {
  return (
    <CometCard className="my-2">
      <PoktProfileCard {...props} />
    </CometCard>
  );
}

export default CometCardDemo;
