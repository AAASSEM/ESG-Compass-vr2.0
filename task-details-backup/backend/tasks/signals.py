"""
Task signals for automatic company score updates
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Task


@receiver(post_save, sender=Task)
def update_company_scores_on_task_save(sender, instance, created, **kwargs):
    """Update company ESG scores when a task is saved"""
    if instance.company:
        from .utils import _update_company_completion_stats
        _update_company_completion_stats(instance.company)


@receiver(post_delete, sender=Task)  
def update_company_scores_on_task_delete(sender, instance, **kwargs):
    """Update company ESG scores when a task is deleted"""
    if instance.company:
        from .utils import _update_company_completion_stats
        _update_company_completion_stats(instance.company)