import { cache } from "react";
import { placeService } from "@/server/services/place-service";

export const getPlacePageData = cache((id: string) => placeService.getPlaceById(id));
