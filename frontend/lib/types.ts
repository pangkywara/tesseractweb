// Shared types for the OCR application

// Data structure for a single detected word
export interface WordData {
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
    confidence: number;
}

// Structure for the API response
export interface OcrApiResponse {
    processed_image_width: number;
    processed_image_height: number;
    words: WordData[];
    full_text: string;
}

// Structure for points (coordinates)
export interface Point { 
    x: number; 
    y: number; 
}

// Structure for selection rectangle coordinates
export interface SelectionRect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
} 