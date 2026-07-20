import { DEFAULT_CARD_SLUG } from "@/config/constants";
import { createClient } from "@/lib/supabase/server";

export class PlaceCardRepository {
  private defaultCardProductIdPromise: Promise<string> | null = null;

  async getDefaultCardProductId(): Promise<string> {
    if (!this.defaultCardProductIdPromise) {
      this.defaultCardProductIdPromise = this.fetchDefaultCardProductId();
    }
    return this.defaultCardProductIdPromise;
  }

  private async fetchDefaultCardProductId(): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_products")
      .select("id")
      .eq("slug", DEFAULT_CARD_SLUG)
      .single();

    if (error || !data) throw new Error("Default card product not found");
    return data.id;
  }
}

export const placeCardRepository = new PlaceCardRepository();
