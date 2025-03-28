-- Make project_code optional in travel_forms table
ALTER TABLE travel_forms ALTER COLUMN project_code DROP NOT NULL;