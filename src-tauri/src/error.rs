//! Application errors shared by every command.
//!
//! Errors are typed and serialized to the frontend as a readable string:
//! no `unwrap()` should ever reach the end user.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("file not found: {0}")]
    NotFound(String),

    #[error("formato non supportato: {0}")]
    UnsupportedFormat(String),

    #[error("file audio illeggibile: {0}")]
    InvalidAudio(String),

    #[error("dati non validi: {0}")]
    Validation(String),

    #[error("file in sola read: {0}")]
    ReadOnly(String),

    #[error("library unavailable: {0}")]
    State(String),

    #[error("errore di I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("errore nei dati salvati: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type AppResult<T> = Result<T, AppError>;

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_has_a_readable_message() {
        let error = AppError::NotFound("C:/music/track.mp3".to_owned());

        assert_eq!(error.to_string(), "file not found: C:/music/track.mp3");
    }

    #[test]
    fn unsupported_format_has_a_readable_message() {
        let error = AppError::UnsupportedFormat("mid".to_owned());

        assert_eq!(error.to_string(), "formato non supportato: mid");
    }

    #[test]
    fn invalid_audio_has_a_readable_message() {
        let error = AppError::InvalidAudio("tag corrotti".to_owned());

        assert_eq!(error.to_string(), "file audio illeggibile: tag corrotti");
    }

    #[test]
    fn state_has_a_readable_message() {
        let error = AppError::State("poisoned lock".to_owned());

        assert_eq!(error.to_string(), "library unavailable: poisoned lock");
    }

    #[test]
    fn io_errors_are_converted_automatically() {
        let io_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "accesso negato");
        let error: AppError = io_error.into();

        assert!(matches!(error, AppError::Io(_)));
        assert!(error.to_string().contains("accesso negato"));
    }

    #[test]
    fn serialization_errors_are_converted_automatically() {
        let json_error = serde_json::from_str::<serde_json::Value>("{ non valido").unwrap_err();
        let error: AppError = json_error.into();

        assert!(matches!(error, AppError::Serialization(_)));
    }

    #[test]
    fn error_is_serialized_as_a_string() {
        let error = AppError::NotFound("track.mp3".to_owned());

        let json = serde_json::to_string(&error).expect("serializzazione riuscita");

        assert_eq!(json, "\"file not found: track.mp3\"");
    }
}
