export interface PhotoData {
    file: File;
    previewUrl: string;
}

export interface LocalPhoto {
    id: string;
    filename: string;
    width: number;
    height: number;
    timestamp?: number | string | Date | null;
    exif?: Record<string, any>;
    aspectRatio?: number;
    dominantOrientation?: "portrait" | "landscape" | "square";
}
