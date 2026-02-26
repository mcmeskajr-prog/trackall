import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kgclapivcpjqxbtomaue.supabase.co";
const SUPABASE_KEY = "sb_publishable_YhoOLoNbQda5iWgCUjLPvQ_HoO4uZ4B";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
