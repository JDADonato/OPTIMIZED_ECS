<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('report_templates')) {
            Schema::create('report_templates', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('visibility')->default('admin');
                $table->json('layout_json');
                $table->json('filters_json')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('report_runs')) {
            Schema::create('report_runs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('report_template_id')->nullable()->constrained('report_templates')->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status')->default('completed');
                $table->json('parameters_json')->nullable();
                $table->json('result_snapshot_json')->nullable();
                $table->string('export_path')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('report_runs');
        Schema::dropIfExists('report_templates');
    }
};
