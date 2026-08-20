//! Commands exposed to the frontend.

pub mod catalog;
pub mod library;
pub mod metadata;
pub mod playback;

use serde::{Deserialize, Serialize};

pub use catalog::{
    create_library, delete_library, export_library, import_library, list_libraries, switch_library,
};
pub use library::{
    add_tracks, export_track_list, library_info, list_tracks, remove_track, rename_library,
    verify_track_file,
};
pub use metadata::{get_cover, read_metadata, write_cover, write_metadata};
pub use playback::{prepare_external_playback, prepare_playback, startup_audio_file};

use crate::metadata::SUPPORTED_EXTENSIONS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub supported_extensions: Vec<String>,
}

pub fn build_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        supported_extensions: SUPPORTED_EXTENSIONS
            .iter()
            .map(|extension| (*extension).to_owned())
            .collect(),
    }
}

/// Returns name, version and supported formats of the application.
#[tauri::command]
pub fn app_info() -> AppInfo {
    build_app_info()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_exposes_package_name_and_version() {
        let info = app_info();

        assert_eq!(info.name, "media-audio-lib");
        assert_eq!(info.version, "0.1.0");
    }

    #[test]
    fn app_info_lists_supported_formats() {
        let info = build_app_info();

        assert_eq!(info.supported_extensions.len(), SUPPORTED_EXTENSIONS.len());
        assert!(info.supported_extensions.contains(&"mp3".to_owned()));
    }

    #[test]
    fn app_info_is_serializable_for_the_frontend() {
        let json = serde_json::to_string(&build_app_info()).expect("serializzazione riuscita");

        assert!(json.contains("\"supportedExtensions\""));
    }
}
