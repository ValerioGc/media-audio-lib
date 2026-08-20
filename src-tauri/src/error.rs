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
    include!("../../tests/backend/error.rs");
}
