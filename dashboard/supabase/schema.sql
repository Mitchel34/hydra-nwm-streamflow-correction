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
    model_version TEXT DEFAULT 'v2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Results table (one row per experiment × site combination)
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    experiment TEXT REFERENCES experiments(experiment_id),
    site_id TEXT REFERENCES sites(site_id),
    model_version TEXT DEFAULT 'v2',
    baseline_rmse DOUBLE PRECISION,
    baseline_nse DOUBLE PRECISION,
    baseline_pbias DOUBLE PRECISION,
    baseline_kge DOUBLE PRECISION,
    baseline_mae DOUBLE PRECISION,
    baseline_pearson_r DOUBLE PRECISION,
    baseline_spearman_r DOUBLE PRECISION,
    corrected_rmse DOUBLE PRECISION,
    corrected_nse DOUBLE PRECISION,
    corrected_pbias DOUBLE PRECISION,
    corrected_kge DOUBLE PRECISION,
    corrected_mae DOUBLE PRECISION,
    corrected_pearson_r DOUBLE PRECISION,
    corrected_spearman_r DOUBLE PRECISION,
    rmse_improvement_pct DOUBLE PRECISION,
    rmse_residual DOUBLE PRECISION,
    quantiles JSONB,
    bias_shift JSONB,
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
CREATE INDEX IF NOT EXISTS idx_results_model_version ON results(model_version);
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

-- Insert experiment definitions (v2)
INSERT INTO experiments (experiment_id, name, description, model_version) VALUES
    ('baseline', 'Baseline (Hydra v2)', 'Current best model without new features', 'v2'),
    ('causal', 'Causal Mask', 'Transformer with causal attention masking', 'v2'),
    ('direct', 'Direct Mode', 'Predict USGS directly (no NWM residual)', 'v2'),
    ('physics', 'Physics Constraint', 'Non-negativity penalty on streamflow', 'v2'),
    ('combined', 'Combined', 'Causal mask + physics constraint', 'v2'),
    ('hydra_v1', 'Hydra v1 (Ablation)', 'Transformer-only (no GRU)', 'v2'),
    ('hydra_v2', 'Hydra v2', 'GRU-Transformer hybrid', 'v2'),
    ('lstm', 'LSTM Baseline', 'Simple LSTM encoder', 'v2')
ON CONFLICT (experiment_id) DO NOTHING;

-- Insert experiment definitions (v3)
INSERT INTO experiments (experiment_id, name, description, model_version) VALUES
    ('v3_baseline', 'Hydra v3 Baseline', 'v3 architecture with feature gate, multi-scale conv, regime bias', 'v3'),
    ('v3_causal', 'v3 + Causal Mask', 'Hydra v3 with causal attention masking', 'v3'),
    ('v3_physics', 'v3 + Physics', 'Hydra v3 with non-negativity constraint', 'v3'),
    ('v3_combined', 'v3 + Causal + Physics', 'Hydra v3 with causal mask and physics constraint', 'v3'),
    ('v3_eventsample', 'v3 + Event Sampling', 'Hydra v3 with 3x oversampling on Q90+ events', 'v3'),
    ('v3_full', 'v3 Full', 'Hydra v3 with causal + physics + event oversampling', 'v3'),
    ('v3_autonorm', 'v3 AutoNorm', 'v3 full + automatic loss normalisation', 'v3')
ON CONFLICT (experiment_id) DO NOTHING;
