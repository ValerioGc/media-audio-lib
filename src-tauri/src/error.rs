//! Application errors shared by every command.
//!
//! Errors are typed and serialized to the frontend as a readable string:
//! no `unwrap()` should ever reach the end user.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("file non trovato: {0}")]
    NotFound(String),

    #[error("formato non supportato: {0}")]
    UnsupportedFormat(String),

    #[error("file audio illeggibile: {0}")]
    InvalidAudio(String),

    #[error("libreria non accessibile: {0}")]
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
    fn not_found_ha_un_messaggio_leggibile() {
        let error = AppError::NotFound("C:/musica/brano.mp3".to_owned());

        assert_eq!(error.to_string(), "file non trovato: C:/musica/brano.mp3");
    }

    #[test]
    fn unsupported_format_ha_un_messaggio_leggibile() {
        let error = AppError::UnsupportedFormat("mid".to_owned());

        assert_eq!(error.to_string(), "formato non supportato: mid");
    }

    #[test]
    fn invalid_audio_ha_un_messaggio_leggibile() {
        let error = AppError::InvalidAudio("tag corrotti".to_owned());

        assert_eq!(error.to_string(), "file audio illeggibile: tag corrotti");
    }

    #[test]
    fn state_ha_un_messaggio_leggibile() {
        let error = AppError::State("lock avvelenato".to_owned());

        assert_eq!(
            error.to_string(),
            "libreria non accessibile: lock avvelenato"
        );
    }

    #[test]
    fn gli_errori_di_io_sono_convertiti_automaticamente() {
        let io_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "accesso negato");
        let error: AppError = io_error.into();

        assert!(matches!(error, AppError::Io(_)));
        assert!(error.to_string().contains("accesso negato"));
    }

    #[test]
    fn gli_errori_di_serializzazione_sono_convertiti_automaticamente() {
        let json_error = serde_json::from_str::<serde_json::Value>("{ non valido").unwrap_err();
        let error: AppError = json_error.into();

        assert!(matches!(error, AppError::Serialization(_)));
    }

    #[test]
    fn l_errore_e_serializzato_come_stringa() {
        let error = AppError::NotFound("brano.mp3".to_owned());

        let json = serde_json::to_string(&error).expect("serializzazione riuscita");

        assert_eq!(json, "\"file non trovato: brano.mp3\"");
    }
}
