<?php

namespace App\Http\Controllers;

use Cloudinary\Cloudinary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
        ]);

        $file = $request->file('file');

        // Production: đẩy lên Cloudinary (bền vững qua redeploy). Trả secure_url tuyệt đối.
        if ($cloudinaryUrl = config('services.cloudinary.url')) {
            $result = (new Cloudinary($cloudinaryUrl))
                ->uploadApi()
                ->upload($file->getRealPath(), ['folder' => 'funcafe']);

            return response()->json([
                'url' => $result['secure_url'],
                'path' => $result['public_id'],
            ], 201);
        }

        // Local dev (không cấu hình Cloudinary): lưu vào disk public như cũ.
        $path = $file->store('uploads', 'public');

        return response()->json([
            'url' => Storage::url($path),
            'path' => $path,
        ], 201);
    }
}
