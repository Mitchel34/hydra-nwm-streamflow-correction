-- Hydra Dashboard Database Schema for Supabase
-- This schema stores experiment results, metrics, and time series predictions

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
    site_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    watershed TEXT NOT NULL,
    type TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
    experiment_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB,  -- Store full training config
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Results table (one row per experiment × site combination)
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    experiment TEXT REFERENCES experiments(experiment_id),
    site_id TEXT REFERENCES sites(site_id),
    baseline_rmse DOUBLE PRECISION,
    baseline_nse DOUBLE PRECISION,
    baseline_pbias DOUBLE PRECISION,
    baseline_kge DOUBLE PRECISION,
    corrected_rmse DOUBLE PRECISION,
    corrected_nse DOUBLE PRECISION,
    corrected_pbias DOUBLE PRECISION,
    corrected_kge DOUBLE PRECISION,
    rmse_improvement_pct DOUBLE PRECISION,
    training_epochs INTEGER,
    training_time_seconds DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(experiment, site_id)
);

-- Predictions table (time series data)
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    experiment TEXT REFERENCES experiments(experiment_id),
    site_id TEXT REFERENCES sites(site_id),
    timestamp TIMESTAMPTZ NOT NULL,
    nwm_value DOUBLE PRECISION NOT NULL,
    usgs_value DOUBLE PRECISION NOT NULL,
    corrected_value DOUBLE PRECISION NOT NULL,
    residual DOUBLE PRECISION,
    lower_ci DOUBLE PRECISION,
    upper_ci DOUBLE PRECISION,
    UNIQUE(experiment, site_id, timestamp)
);

-- Gradient logs table (for training analysis)
CREATE TABLE IF NOT EXISTS gradient_logs (
    id SERIAL PRIMARY KEY,
    experiment TEXT REFERENCES experiments(experiment_id),
    site_id TEXT REFERENCES sites(site_id),
    epoch INTEGER NOT NULL,
    layer_name TEXT NOT NULL,
    mean_grad DOUBLE PRECISION NOT NULL,
    max_grad DOUBLE PRECISION NOT NULL,
    min_grad DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_results_experiment ON results(experiment);
CREATE INDEX IF NOT EXISTS idx_results_site ON results(site_id);
CREATE INDEX IF NOT EXISTS idx_predictions_experiment_site ON predictions(experiment, site_id);
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp);
CREATE INDEX IF NOT EXISTS idx_gradient_logs_experiment ON gradient_logs(experiment);

-- Row Level Security (optional - enable if needed)
-- ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE results ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Insert initial site data
INSERT INTO sites (site_id, name, watershed, type, lat, lon) VALUES
    ('03161000', 'South Fork New River near Jefferson, NC', 'New River', 'mid-basin', 36.4003, -81.4206),
    ('03164000', 'New River near Galax, VA', 'New River', 'mainstem', 36.6456, -80.9272),
    ('03479000', 'Watauga River near Sugar Grove, NC', 'Watauga', 'headwaters', 36.2367, -81.8289),
    ('03486000', 'Watauga River at Elizabethton, TN', 'Watauga', 'regulated', 36.3431, -82.2108)
ON CONFLICT (site_id) DO NOTHING;

-- Insert experiment definitions
INSERT INTO experiments (experiment_id, name, description) VALUES
    ('baseline', 'Baseline (Hydra v2)', 'Current best model without new features'),
    ('causal', 'Causal Mask', 'Transformer with causal attention masking'),
    ('direct', 'Direct Mode', 'Predict USGS directly (no NWM residual)'),
    ('physics', 'Physics Constraint', 'Non-negativity penalty on streamflow'),
    ('combined', 'Combined', 'Causal mask + physics constraint'),
    ('hydra_v1', 'Hydra v1 (Ablation)', 'Transformer-only (no GRU)'),
    ('hydra_v2', 'Hydra v2', 'GRU-Transformer hybrid'),
    ('lstm', 'LSTM Baseline', 'Simple LSTM encoder')
ON CONFLICT (experiment_id) DO NOTHING;
